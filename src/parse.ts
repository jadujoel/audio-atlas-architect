/**
 * An enumeration of the different types of compression used on the audio data.
 * For PCM (Pulse Code Modulation), which is uncompressed audio data, the value is typically 1.
 * Other values indicate different types of compression.
 */
export enum AudioFormat {
  PCM = 1,
  MicrosoftADPCM = 2,
  IEEEFloat = 3,
  ALaw = 6,
  MuLaw = 7,
  IMAADPCM = 17,
  ITUG721ADPCM = 20,
  GSM610 = 49,
  ITUG723ADPCM = 64,
  MPEG = 80,
  AAC = 255,
  DolbyAC3 = 8192
}

/**
 * The "fmt " chunk of a WAV file contains information about the format of the audio data.
 * This interface represents the "fmt " chunk of a WAV file.
 */
export interface FormatChunk {
  /**
   * This field specifies the type of compression used on the audio data.
   * For PCM (Pulse Code Modulation), which is uncompressed audio data, this value is typically 1.
   * Other values indicate different types of compression.
   */
  readonly audioFormat: AudioFormat | number
  /**
   * This is the number of separate audio channels in the data.
   * A value of 1 means mono sound, 2 means stereo,
   * etc. In multichannel audio, each channel usually represents a separate speaker in a surround sound setup.
   */
  readonly numChannels: number
  /**
   * This is the number of samples per second, per channel.
   * A sample is a snapshot of the audio signal at a specific point in time.
   * The standard sample rates are 44.1 kHz (CD quality), 48 kHz (professional audio), 88.2 kHz, 96 kHz, and 192 kHz.
   * The higher the sample rate, the better the quality of the audio, but the larger the file size.
   */
  readonly sampleRate: number
  /**
   * Also known as the data rate, this is the number of bytes processed per second when the file is played.
   * It's calculated as Sample Rate * Num Channels * Bits per Sample / 8.
   * This field is important for buffering and I/O operations, as it tells the audio player how much data to expect to process per second.
   */
  readonly byteRate: number
  /**
   * The "Block Align" (blockAlign) field in the "fmt " chunk of a WAV file specifies the number of bytes for one "block" of audio data.
   * This block of data includes all channels.
   * For PCM (Pulse Code Modulation) audio, which is the most common format in WAV files, each block represents one sample across all channels.
   * So, for example, if you have a stereo (2-channel) audio file with a bit depth of 16 bits,
   * each block would be 4 bytes: 2 bytes for the left channel, and 2 bytes for the right channel.
   * The block align value is critical for playback of the audio file.
   * The audio player needs to know the size of each block so it can correctly read the data for each sample.
   * In the context of the WAV file format, the block align is usually calculated as:
   * NumChannels * BitsPerSample / 8
   * This gives you the number of bytes used for each block (or sample) of data.
   */
  readonly blockAlign: number
  /**
   * This specifies the bit depth or the number of bits of information in each sample.
   * The standard is 16 bits for CD quality audio, although 24 and 32 bits are also common in professional audio.
   * More bits per sample can give a more accurate representation of the original signal, leading to higher quality audio.
   */
  readonly bitsPerSample: number
}

export interface WaveData extends FormatChunk {
  /**
   * The size of the data chunk in bytes.
   */
  readonly dataChunkSize: number
  /**
   * The number of samples in the audio data.
   * This is calculated as the size of the data chunk divided by the block align.
   * This is the number of samples per channel, so the total number of samples in the audio file is this number multiplied by the number of channels.
   * For example, a 16-bit stereo audio file with a data chunk size of 4000 bytes would have 1000 samples per channel, or 2000 samples total.
   */
  readonly numSamples: number
  /**
   * The duration of the audio in seconds.
   * This is calculated as the number of samples divided by the sample rate.
   * For example, a 16-bit stereo audio file with a sample rate of 44100 Hz would have a duration of 2000 / 44100 = 0.045351 seconds.
   */
  readonly duration: number
}

// Function to read four bytes as an unsigned integer.
function readUInt32 (buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset)
}

// Function to read two bytes as an unsigned integer.
function readUInt16 (buffer: Buffer, offset: number): number {
  return buffer.readUInt16LE(offset)
}

// Function to read four bytes as a string.
function readString (buffer: Buffer, offset: number): string {
  return buffer.toString('ascii', offset, offset + 4)
}

/**
 * Checks if the given data object is a valid FormatChunk object.
 * @param data The data object to check.
 * @returns True if the object is a valid FormatChunk object, false otherwise.
 */
function isFormatChunk (data: Partial<FormatChunk>): data is FormatChunk {
  return (
    typeof data.audioFormat === 'number' &&
    typeof data.numChannels === 'number' &&
    typeof data.sampleRate === 'number' &&
    typeof data.byteRate === 'number' &&
    typeof data.blockAlign === 'number' &&
    typeof data.bitsPerSample === 'number'
  )
}

/**
 * Checks if the given data object is a valid WavData object.
 * @param data The data object to check.
 * @returns True if the object is a valid WavData object, false otherwise.
 */
export function isWavData (data: Partial<WaveData>): data is WaveData {
  return (
    typeof data.numSamples === 'number' &&
    typeof data.duration === 'number' &&
    typeof data.dataChunkSize === 'number' &&
    isFormatChunk(data)
  )
}

/**
 * Parses a WAV file and logs information about its format and data.
 * @param fileName The path to the WAV file to parse.
 * @throws An error if the file is not a valid WAV file or if no data chunk is found.
 */
export function parseWaveFileBuffer (buffer: Buffer): readonly [null, WaveData] | readonly [Error, null] {
  if (readString(buffer, 0) !== 'RIFF' || readString(buffer, 8) !== 'WAVE') {
    return [new Error('WAV doesnt start with RIFF.'), null]
  }

  let offset = 12
  let formatChunk: Partial<FormatChunk> = {}
  let size = 0

  while (offset < buffer.length) {
    try {
      const chunkId = readString(buffer, offset)
      const chunkSize = readUInt32(buffer, offset + 4)

      if (chunkId === 'fmt ') {
        const audioFormat = readUInt16(buffer, offset + 8)
        const numChannels = readUInt16(buffer, offset + 10)
        const sampleRate = readUInt32(buffer, offset + 12)
        const byteRate = readUInt32(buffer, offset + 16)
        const blockAlign = readUInt16(buffer, offset + 20)
        const bitsPerSample = readUInt16(buffer, offset + 22)
        formatChunk = {
          audioFormat,
          numChannels,
          sampleRate,
          byteRate,
          blockAlign,
          bitsPerSample
        }
      } else if (chunkId === 'data') {
        size = chunkSize
        break
      }

      offset += 8 + chunkSize
    } catch (error) {
      return error instanceof Error
        ? [error, null]
        : [new Error(String(error)), null]
    }
  }

  if (!isFormatChunk(formatChunk)) {
    return [new Error('Failed to parse WAV format chunk.'), null]
  }

  if (size === 0) {
    return [new Error('No data chunk found'), null]
  }

  const numSamples = size / formatChunk.blockAlign
  const duration = numSamples / formatChunk.sampleRate
  return [
    null,
    {
      ...formatChunk,
      numSamples,
      duration,
      dataChunkSize: size
    }]
}

/**
 * Prints the format and data information of a WAV file to the console.
 * @param data The WAV data to print.
 */
export function printWaveData (data: WaveData): void {
  // eslint-disable-next-line no-console
  console.log(
    `Audio Format: ${data.audioFormat}\n` +
    `Number of Channels: ${data.numChannels}\n` +
    `Sample Rate: ${data.sampleRate}\n` +
    `Byte Rate: ${data.byteRate}\n` +
    `Block Align: ${data.blockAlign}\n` +
    `Bits per Sample: ${data.bitsPerSample}\n` +
    `Data Size: ${data.dataChunkSize}\n` +
    `Number of Samples: ${data.numSamples}\n` +
    `Duration: ${data.duration} seconds\n`
  )
}
