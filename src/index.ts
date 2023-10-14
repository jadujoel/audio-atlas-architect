import { run } from 'ffmpeg-helper'
import { err, ok, type Result } from 'neverthrow'
import { createHash } from 'node:crypto'
import { copyFile, cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { cpus } from 'node:os'
import { join, resolve } from 'node:path'
import { parseWaveFileBuffer } from './parse'
import type { Bank, BankConfig, EncodeConfig, Media } from './types'

function copyDirectory(source: string, target: string): Promise<void> {
  return cp(source, target, { recursive: true })
}

function hash_buffer(data: Buffer): string {
  return createHash('md5').update(data).digest('hex')
}

function hash_record(data: Record<string, any>) {
  return createHash('md5').update(JSON.stringify(data)).digest('hex')
}

const verbose = process.argv.includes('--verbose')
const silent = process.argv.includes('--silent')
const force = process.argv.includes('--force')
const logs: string[][] = []

function debug(...args: any[]): void {
  if (verbose) {
    console.debug(...args)
  }
  logs.push(['[debug]', ...args])
}

function log(...args: any[]): void {
  if (!silent) {
    console.log(...args)
  }
  logs.push(['[log]', ...args])
}

export async function encode (config: EncodeConfig): Promise<Result<void, Error>> {
  try {
    const { banks: projects, cache, rootdir, outdir } = config
    const concurrency = config.concurrency ?? (cpus().length / 2)
    debug("Using concurrency", concurrency)
    let currently_processing = 0
    async function canProceed() {
      return new Promise<void>(resolve => {
        if (currently_processing < concurrency) {
          resolve()
          return
        }
        const id = setInterval(() => {
          if (currently_processing < concurrency) {
            resolve()
            clearInterval(id)
          }
        }, 5)
      })
    }

    if (force) {
      log("Forcing rebuild")
      await rm(cache, { recursive: true, force: true })
    }

    if (process.argv.includes('--clean')) {
      log("Cleaning")
      await rm(outdir, { recursive: true, force: true })
      if (!process.argv.includes('--build')) {
        return ok(undefined)
      }
    }

    const hashes_file = `${cache}/hashes.json`
    const banks_cache_dir = join(cache, 'banks')

    const loglevel = verbose ? 'verbose' : 'warning'

    const cached_hashes: Record<string, string> = await readFile(hashes_file, { encoding: 'utf-8' })
      .then(content => JSON.parse(content))
      .catch(_ => ({}))

    const [rootdir_hash, hashes] = await crawl_timestamp_hash(rootdir)
    if (rootdir_hash === cached_hashes[rootdir] && !force) {
      log("Full Turbo")
      await copyDirectory(banks_cache_dir, outdir)
      return ok(undefined)
    }

    for (const [project_name, project] of Object.entries(projects)) {
      const { outdir, rootdir: srcdir, base, media } = project
      const cache_dir = join(banks_cache_dir, project_name)
      let allLanguages: string[] = []

      log("Processing project", project_name)

      if (hashes[srcdir] === cached_hashes[srcdir] && !force) {
        debug("Project cached", project_name)
        await copyDirectory(cache_dir, outdir)
        continue
      }

      const data_file_cached = `${cache_dir}/media.json`

      const cached_datas: Media[] = await readFile(data_file_cached, { encoding: 'utf-8' })
        .then(JSON.parse)
        .catch(_ => [])

      await mkdir(cache_dir, { recursive: true })

      for (const [key, value] of Object.entries(media)) {
        const promises: Promise<void>[] = []
        const { bitrate, channels, localization } = value

        // we push '' so that it also looks in the root directory
        const languages = ['', ...(localization[0] as string) === '*'
          ? await find_directories(`${srcdir}/${key}`)
          : localization]

        allLanguages.push(...languages)

        for (const language of languages) {
          const relative = `${key}/${language}`
          const indir = `${srcdir}/${relative}`
          const targetdir = `${outdir}/${relative}`
          const outdir_cached = `${cache_dir}/${relative}`

          const language_dir_hash = hashes[indir.endsWith('/') ? indir.slice(0, -1) : indir]
          if (
            language_dir_hash === undefined ||
            (cached_hashes[indir] === language_dir_hash && !force)
          ) {
            promises.push(copyDirectory(indir, targetdir))
            continue
          }

          await mkdir(outdir_cached, { recursive: true })

          const files: readonly string[] = await readdir(indir)
          const more_promises = files.map(async file => {
            if (!file.endsWith('wav')) {
              return
            }
            if (currently_processing > concurrency) {
              await canProceed()
            }
            currently_processing += 1

            const name = file.replace('.wav', '')
            const infile = join(indir, file)
            const outfile = join(targetdir, `${name}.webm`)
            const outfile_cached = join(outdir_cached, `${name}.webm`)

            if (hashes[infile] === cached_hashes[infile] && !force) {
              const index = cached_datas.findIndex(datas => datas.srcpath === infile)
              if (index === -1) {
                console.warn("Bad cached data", infile)
              } else {
                promises.push(copyFile(outfile_cached, outfile))
                currently_processing--
                return
              }
            }

            debug("Processing", infile)
            const inbuffer = await readFile(infile)
            const [err, waveWata] = parseWaveFileBuffer(inbuffer)
            if (err !== null) {
              throw err
            }
            const { numChannels: inchannels, duration, numSamples } = waveWata
            const gain = inchannels === channels ? 0 : -3

            const data: Media = {
              name,
              base,
              group: key,
              language,
              srcpath: infile,
              loadpath: join(base, relative, `${name}.webm`),
              hash: hash_buffer(inbuffer),
              channels,
              duration,
              num_samples: numSamples,
              sample_rate: 48000,
              bitrate,
            }

            const index = cached_datas.findIndex(datas => datas.srcpath === infile)
            if (index !== -1) {
              cached_datas[index] = data
            } else {
              cached_datas.push(data)
            }

            const cmd = gain === 0
              ? `-hide_banner -strict very -loglevel ${loglevel} -i ${infile} -c:a libopus -b:a ${bitrate}k -vbr constrained -ac ${channels} -ar 48000 -filter:a volume=${gain}dB -y ${outfile_cached}`
              : `-hide_banner -strict very -loglevel ${loglevel} -i ${infile} -c:a libopus -b:a ${bitrate}k -vbr constrained -ac ${channels} -ar 48000 -y ${outfile_cached}`

            const { stderr } = await run(cmd)

            if (stderr !== '') {
              logs.push(['[ffmpeg]', outfile_cached, stderr])
            }

            if (config.legacy_support) {
              const mp4_file = outfile_cached.replace('.webm', '.mp4')
              const cmd = gain === 0
                ? `-hide_banner -strict very -loglevel ${loglevel} -i ${infile} -c:a aac -movflags faststart -b:a ${bitrate}k -ac ${channels} -ar 48000 -y ${mp4_file}`
                : `-hide_banner -strict very -loglevel ${loglevel} -i ${infile} -c:a aac -movflags faststart -b:a ${bitrate}k -ac ${channels} -ar 48000 -filter:a volume=${gain}dB -y ${mp4_file}`
              const { stderr } = await run(cmd)
              if (stderr !== '') {
                logs.push(['[ffmpeg]', mp4_file ,stderr])
              }
            }
            currently_processing--
          })
          promises.push(...more_promises)
        }
        await Promise.all(promises)
      }

      // if this project extends another project, we need to merge the data
      // by loading the data from the base project, and then for each file in the extending project
      // check if there is another with the same name and language in the extending project,
      // AND if so, dont push the base data, otherwise push it
      // this way, the extending project can override the base project
      const base_project = (project as BankConfig).extends
      if (base_project !== undefined) {
        const base_project_data_file = `${cache}/banks/${base_project}/media.json`
        const base_project_datas: Media[] = await readFile(base_project_data_file, { encoding: 'utf-8' }).then(JSON.parse)
        for (const data of base_project_datas) {
          const { name, language } = data
          const index = cached_datas.findIndex(datas => datas.name === name && datas.language === language)
          if (index === -1) {
            cached_datas.push(data)
          }
        }
      }

      const out = JSON.stringify(cached_datas, null, 2)
      await writeFile(data_file_cached, out)

      const partial = {
        name: project_name,
        base,
        srcdir,
        groups: Object.keys(media),
        languages: [...new Set(allLanguages)],
        media: cached_datas,
      }
      const bank: Bank = {
        ...partial,
        hash: hash_record(partial),
      }
      await writeFile(`${cache_dir}/bank.json`, JSON.stringify(bank, null, 2))
      await writeFile(`${cache_dir}/bank.min.json`, JSON.stringify(bank))
    }

    await writeFile(hashes_file, JSON.stringify(hashes, null, 2))

    const projectInfo = {
      name: config.name,
      banks: Object.keys(projects),
    }

    await writeFile(`${cache}/.logs.log`, JSON.stringify(logs, null, 2))
    await writeFile(`${cache}/banks/project.json`, JSON.stringify(projectInfo, null, 2))
    await copyDirectory(banks_cache_dir, outdir)
  } catch (error) {
    return err(error instanceof Error ? error : new Error(JSON.stringify(error)))
  }
  return ok(undefined)
}

async function find_directories(path: string) {
  const dirents = await readdir(path, { withFileTypes: true })
  return dirents.filter(path => path.isDirectory()).map(path => path.name)
}

async function crawl_timestamp_hash(
  directory: string,
  hashes: Record<string, string> = {}
): Promise<readonly [string, Record<string, string>]> {
  const hash = createHash('md5');
  const files = await readdir(directory);
  for (const file of files) {
    const filePath = join(directory, file);
    const fileStat = await stat(filePath);
    const str = filePath + fileStat.mtime.getTime().toString()
    hash.update(str);
    if (fileStat.isDirectory()) {
      const [result, new_hashes] = await crawl_timestamp_hash(filePath, hashes)
      hashes = new_hashes
      hashes[filePath] = result
      hash.update(result);
    } else if (filePath.endsWith('wav')) {
      hashes[filePath] = createHash('md5').update(str).digest('hex');
    }
  }
  const result = hash.digest('hex');
  hashes[directory] = result;
  return [result, hashes]
}

export async function watch(config: EncodeConfig): Promise<void> {
  const { rootdir } = config
  const watcher = await import('chokidar')
  const watcherInstance = watcher.watch(rootdir, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
  })
  await main(config)
  let isProcessing = false
  watcherInstance.on('all', async (event, path) => {
    debug('Changed', path)
    if (isProcessing) {
      return
    }
    isProcessing = true
    await main(config)
    isProcessing = false
  })
}

export async function main(config: EncodeConfig): Promise<void> {
  const startTime = Date.now()
  if (process.argv.includes('--clean-cache')) {
    log("Cleaning cache")
    await rm(config.cache, { recursive: true, force: true })
  }
  await encode(config).then(res => {
    const endTime = Date.now()
    const duration = (endTime - startTime) / 1000
    const time = duration < 1
      ? `${(duration * 1000)}ms`
      : duration < 60
        ? `${duration.toPrecision(2)}s`
        : `${(duration / 60).toPrecision(2)}m`
    log(`Finished in ${time}`)

    if (res.isErr()) {
      throw res.error
    }
  })
}

async function if_main() {
  // check if this is the main file in modern systems
  // and then if not modern check with node if is main file
  if (import.meta.url === `file://${process.argv[1]}` || (require as any)?.main === module) {
    let file = process.argv[2]
    if (file === undefined) {
      throw new Error('Must specify config file. For example `bun encoder config.ts --force`')
    }
    file = resolve(file)
    debug(`Importing config from ${file}`)
    const config = file.endsWith('.json')
      ? await readFile(file, { encoding: 'utf-8' }).then(JSON.parse)
      : (await import(file)).default
    if (process.argv.includes('--watch')) {
      log("Watching")
      await watch(config)
    } else {
      await main(config)
    }
  }
}

if_main()
