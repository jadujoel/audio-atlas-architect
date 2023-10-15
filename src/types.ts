export interface EntryConfig {
  /** Mono or Stereo */
  readonly channels: 1 | 2,
  /** The bitrate in kbits */
  readonly bitrate: number,
  /** A list of directories containing files for different languages */
  readonly localization: readonly string[]
  /**
   * An optional path to look for files
   * @example '../common'
   **/
  readonly extends?: string
}

export interface BankConfig {
  /** The base that will be used when loading the sounds
   * @example
   * 'https:ecas.tech/assets/sounds/game'
   */
  readonly base: string
  /** The root directory of your sound files */
  readonly rootdir: string,
  /** The output directory for your sound files */
  readonly outdir: string,
  readonly media: Readonly<Record<string, EntryConfig>>
  readonly extends?: string
  readonly default_language: string
}

export interface EncodeConfig {
  readonly name: string
  readonly cache: string
  readonly banks: Readonly<Record<string, BankConfig>>
  readonly rootdir: string
  readonly outdir: string
  readonly legacy_support: boolean
  readonly concurrency?: number
}

export interface BankProperties {
  readonly name: string
  readonly id: number
  readonly base: string
  readonly srcdir: string
  readonly languages: readonly string[]
  readonly default_language: string
  readonly groups: readonly string[]
  readonly hash: string
  readonly media: MediaProperties[]
}

export interface MediaProperties {
  readonly name: string
  readonly id: number
  readonly hash: string
  readonly duration: number
  readonly channels: number
  readonly num_samples: number
  readonly sample_rate: number
  readonly bitrate: number
  readonly base: string
  readonly loadpath: string
  readonly srcpath: string
  readonly group: string
  readonly group_index: number
  readonly language: string
  readonly language_index: number
}
