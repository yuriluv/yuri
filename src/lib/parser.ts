export type ParsedMessage = {
  timestamp: number
  datetimeLabel: string
  author: string
  message: string
  isSystem?: boolean
}

export type ParseResult = {
  messages: ParsedMessage[]
  ignoredLines: number
}

const fullLineRegex = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(오전|오후)\s*(\d{1,2}):(\d{2}),\s*(.+?)\s*:\s*(.*)$/
const fullSystemRegex = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(오전|오후)\s*(\d{1,2}):(\d{2}),\s*(.+)$/
const dateOnlyRegex = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일(?:\s+\S+요일)?$/
const dateTimeOnlyRegex = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(오전|오후)\s*(\d{1,2}):(\d{2})$/
const bracketMessageRegex = /^(.*?)\s*\[(오전|오후)\s*(\d{1,2}):(\d{2})\]\s*(.*)$/

function to24Hour(ampm: string, hour: number) {
  if (ampm === '오전') return hour === 12 ? 0 : hour
  return hour === 12 ? 12 : hour + 12
}

function toTimestamp(year: number, month: number, day: number, ampm: string, hour: number, minute: number) {
  return Date.UTC(year, month - 1, day, to24Hour(ampm, hour), minute, 0, 0)
}

export function toDatetimeLocalValue(ts: number) {
  const date = new Date(ts)
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const min = String(date.getUTCMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

export function parseDatetimeLocal(input: string) {
  if (!input) return undefined
  return new Date(`${input}:00Z`).getTime()
}

export function formatMessages(messages: ParsedMessage[]) {
  return messages
    .map((item) => (item.isSystem ? item.message : `${item.author} : ${item.message}`))
    .join('\n')
}

export function parseKakaoText(raw: string): ParseResult {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const messages: ParsedMessage[] = []
  let current: ParsedMessage | null = null
  let currentDate: { year: number; month: number; day: number } | null = null
  let ignoredLines = 0

  const flush = () => {
    if (current) {
      messages.push({ ...current, message: current.message.trimEnd() })
      current = null
    }
  }

  for (const line of lines) {
    const full = line.match(fullLineRegex)
    if (full) {
      flush()
      const [, y, m, d, ampm, hh, mm, author, message] = full
      current = {
        timestamp: toTimestamp(Number(y), Number(m), Number(d), ampm, Number(hh), Number(mm)),
        datetimeLabel: `${y}년 ${m}월 ${d}일 ${ampm} ${hh}:${mm}`,
        author: author.trim(),
        message,
      }
      currentDate = { year: Number(y), month: Number(m), day: Number(d) }
      continue
    }

    const fullSystem = line.match(fullSystemRegex)
    if (fullSystem) {
      flush()
      const [, y, m, d, ampm, hh, mm, message] = fullSystem
      current = {
        timestamp: toTimestamp(Number(y), Number(m), Number(d), ampm, Number(hh), Number(mm)),
        datetimeLabel: `${y}년 ${m}월 ${d}일 ${ampm} ${hh}:${mm}`,
        author: '',
        message: message.trim(),
        isSystem: true,
      }
      currentDate = { year: Number(y), month: Number(m), day: Number(d) }
      continue
    }

    const dateOnly = line.match(dateOnlyRegex)
    if (dateOnly) {
      flush()
      currentDate = {
        year: Number(dateOnly[1]),
        month: Number(dateOnly[2]),
        day: Number(dateOnly[3]),
      }
      continue
    }

    const dateTimeOnly = line.match(dateTimeOnlyRegex)
    if (dateTimeOnly) {
      flush()
      currentDate = {
        year: Number(dateTimeOnly[1]),
        month: Number(dateTimeOnly[2]),
        day: Number(dateTimeOnly[3]),
      }
      continue
    }

    const bracket = line.match(bracketMessageRegex)
    if (bracket && currentDate) {
      flush()
      const [, author, ampm, hh, mm, message] = bracket
      current = {
        timestamp: toTimestamp(currentDate.year, currentDate.month, currentDate.day, ampm, Number(hh), Number(mm)),
        datetimeLabel: `${currentDate.year}년 ${currentDate.month}월 ${currentDate.day}일 ${ampm} ${hh}:${mm}`,
        author: author.trim(),
        message,
      }
      continue
    }

    if (current) {
      current.message += current.message.length > 0 ? `\n${line}` : line
    } else if (line.trim().length > 0) {
      ignoredLines += 1
    }
  }

  flush()
  return { messages, ignoredLines }
}
