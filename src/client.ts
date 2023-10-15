import type { BankProperties, MediaProperties } from "./types";
export * from './types';

export interface BankState {
  language: string
  active: MediaProperties[]
  default: MediaProperties[]
  fallback: MediaProperties[]
}

export class Bank {
  state: BankState

  constructor (public readonly properties: BankProperties) {
    const current = this.properties.media.filter(item => item.language === this.properties.default_language)
    this.state = {
      language: '',
      active: current,
      default: current,
      fallback: this.properties.media.filter(item => item.language === '')
    }
  }

  setLanguage(language: string | number): void {
    this.state.active = typeof language === 'string'
      ? this.properties.media.filter(item => item.language === language)
      : this.properties.media.filter(item => item.language_index === language)
  }

  filterLanguage(language: string | number): MediaProperties[] {
    return typeof language === 'string'
      ? this.properties.media.filter(item => item.language === language)
      : this.properties.media.filter(item => item.language_index === language)
  }

  filterGroup(group: string | number): MediaProperties[] {
    return typeof group === 'string'
      ? this.properties.media.filter(item => item.group === group)
      : this.properties.media.filter(item => item.group_index === group)
  }

  filterBank(bank: string | number): MediaProperties[] {
    return typeof bank === 'string'
      ? this.properties.media.filter(item => item.bank === bank)
      : this.properties.media.filter(item => item.bank_id === bank)
  }

  findName(name: string): MediaProperties | undefined {
    return this.state.active.find(item => item.name === name)
      ?? this.state.default.find(item => item.name === name)
      ?? this.state.fallback.find(item => item.name === name)
  }

  findId(id: number): MediaProperties | undefined {
    return this.properties.media.find(item => item.id === id)
  }
}

export interface BankLoaderState {
  items: Map<number, LoadReturn>
}

export interface BankLoaderProperties {
  readonly host: string
  readonly config: BankProperties
  readonly context: AudioContext
  readonly useMp4: boolean
}

export interface LoadReturn {
  readonly promise: Promise<AudioBuffer>
  readonly buffer: AudioBuffer
}

export class BankLoader {
  state: BankLoaderState
  empty: LoadReturn
  bank: Bank
  constructor (public readonly properties: BankLoaderProperties) {
    this.bank = new Bank(properties.config)
    this.state = {
      items: new Map(),
    }
    const emptyBuffer = this.properties.context.createBuffer(1, 8, this.properties.context.sampleRate)
    this.empty = {
      promise: Promise.resolve(emptyBuffer),
      buffer: emptyBuffer
    }
  }

  loadId(id: number): LoadReturn {
    const media = this.bank.findId(id)
    if (media === undefined) {
      console.debug('failed to find media with id', id)
      return this.empty
    }
    return this.loadMedia(media)
  }

  loadName(name: string): LoadReturn {
    const media = this.bank.findName(name)
    if (media === undefined) {
      console.debug('failed to find media with name', name)
      return this.empty
    }
    return this.loadMedia(media)
  }

  loadGroup(group: string | number): LoadReturn[] {
    return this.bank.filterGroup(group).map(media => this.loadMedia(media))
  }

  loadLanguage(language: string | number): LoadReturn[] {
    return this.bank.filterLanguage(language).map(media => this.loadMedia(media))
  }

  loadBank(name: string): LoadReturn[] {
    return this.bank.filterBank(name)
      .map(media => this.loadMedia(media))
  }

  loadAll(): LoadReturn[] {
    return this.bank.properties.media.map(media => this.loadMedia(media))
  }

  loadMedia(media: MediaProperties): LoadReturn {
    let item = this.state.items.get(media.id)
    if (item === undefined) {
      // immediatly create an empty buffer with the number of channels and sample rate and num_samples
      // once fetching is done, we will replace the buffer with the actual data
      const context = this.properties.context
      const num_samples = Math.ceil(media.num_samples * (context.sampleRate / media.sample_rate))
      const buffer = this.properties.context.createBuffer(media.channels, num_samples, context.sampleRate)
      const loadpath = this.properties.useMp4 ? media.loadpath.replace('.webm', '.mp4') : media.loadpath
      const url = `${this.properties.host}${loadpath}`
      const promise = fetch(url)
        .then(response => response.arrayBuffer())
        .then(buffer => this.properties.context.decodeAudioData(buffer))
        .then(decoded => {
          for (let channel = 0; channel < media.channels; channel++) {
            buffer.copyToChannel(decoded.getChannelData(channel), channel)
          }
          return buffer
        })
        .catch(_ => {
          console.debug(_);
          return Promise.reject(new Error(`failed to fetch ${url}`))
        })
      item = {
        promise,
        buffer
      }
      this.state.items.set(media.id, item)
    }
    return item
  }

  setPrioritiesByGroups(group: string[]): void {
    this.bank.properties.media.sort((a, b) => {
      const a_index = group.indexOf(a.group)
      const b_index = group.indexOf(b.group)
      if (a_index === -1) {
        return 1
      }
      if (b_index === -1) {
        return -1
      }
      return a_index - b_index
    })
  }

  setPrioritiesByIds(ids: number[]): void {
    this.bank.properties.media.sort((a, b) => {
      const a_index = ids.indexOf(a.id)
      const b_index = ids.indexOf(b.id)
      if (a_index === -1) {
        return 1
      }
      if (b_index === -1) {
        return -1
      }
      return a_index - b_index
    })
  }
}
