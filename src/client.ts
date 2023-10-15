import { Result, err, ok } from "neverthrow";
import type { BankProperties, MediaProperties } from "./types";
export * from './types';

export interface BankState {
  language: string
  active: MediaProperties[]
  default: MediaProperties[]
  fallback: MediaProperties[]
}

export class Bank {
  readonly state: BankState
  constructor (public readonly properties: BankProperties) {
    const current = this.properties.media.filter(item => item.language === this.properties.default_language)
    this.state = {
      language: '',
      active: current,
      default: current,
      fallback: this.properties.media.filter(item => item.language === '')
    }
  }

  setLanguage(language: string | number): this {
    this.state.active = typeof language === 'string'
      ? this.properties.media.filter(item => item.language === language)
      : this.properties.media.filter(item => item.language_index === language)
    return this
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

  findName(name: string): Result<MediaProperties, Error> {
    const found = this.state.active.find(item => item.name === name)
      ?? this.state.default.find(item => item.name === name)
      ?? this.state.fallback.find(item => item.name === name)
    return found === undefined
      ? err(new Error(`failed to find media with name ${name}`))
      : ok(found)
  }

  findId(id: number): Result<MediaProperties, Error> {
    const found = this.properties.media.find(item => item.id === id)
    return found === undefined
      ? err(new Error(`failed to find media with id ${id}`))
      : ok(found)
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
  readonly promise: Promise<Result<AudioBuffer, Error>>
  readonly buffer: AudioBuffer
}

export class BankLoader {
  readonly state: BankLoaderState
  readonly empty: LoadReturn
  readonly bank: Bank
  constructor (public readonly properties: BankLoaderProperties) {
    this.bank = new Bank(properties.config)
    this.state = {
      items: new Map(),
    }
    const emptyBuffer = this.properties.context.createBuffer(1, 8, this.properties.context.sampleRate)
    this.empty = {
      promise: Promise.resolve(err(new Error('empty buffer'))),
      buffer: emptyBuffer,
    }
  }

  loadId(id: number): Result<LoadReturn, Error> {
    return this.bank.findId(id).andThen(found => ok(this.loadMedia(found)))
  }

  loadName(name: string): Result<LoadReturn, Error> {
    return this.bank.findName(name).andThen(found => ok(this.loadMedia(found)))
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
    const item = this.state.items.get(media.id)
    if (item !== undefined) {
      return item
    }
    const context = this.properties.context
    const num_samples = Math.ceil(media.num_samples * (context.sampleRate / media.sample_rate))
    const buffer = context.createBuffer(media.channels, num_samples, context.sampleRate)
    const loadpath = this.properties.useMp4 ? media.loadpath.replace('.webm', '.mp4') : media.loadpath
    const url = `${this.properties.host}${loadpath}`
    const newItem: LoadReturn = {
      buffer,
      promise: new Promise<Result<AudioBuffer, Error>>(
      async resolve => {
        const response = await fetch(url).catch(_ => undefined)
        if (response === undefined) {
          resolve(err(new Error(`failed to fetch ${url}`)))
          return
        }
        if (!response.ok) {
          resolve(err(new Error(`server return bad response for ${response.url} with status ${response.status}`)))
          return
        }
        const array = await response.arrayBuffer().catch(_ => undefined)
        if (array === undefined) {
          resolve(err(new Error(`failed to convert response to arraybuffer for ${response.url}`)))
          return
        }
        const decoded = await context.decodeAudioData(array).catch(_ => undefined)
        if (decoded === undefined) {
          resolve(err(new Error(`failed to decode audio data for ${media.name}`)))
          return
        }
        try {
          for (let channel = 0; channel < media.channels; channel++) {
            buffer.copyToChannel(decoded.getChannelData(channel), channel)
          }
        } catch (e) {
          resolve(err(new Error(`failed to copy audio data using copyToChannel for ${media.name} ${e}`)))
          return
        }
        resolve(ok(buffer))
      })
    }
    this.state.items.set(media.id, newItem)
    return newItem
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
