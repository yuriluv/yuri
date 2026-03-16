import { useMemo, useState } from 'react'

type ParsedMessage = {
  timestamp: number
  datetimeLabel: string
  author: string
  message: string
}

type ParseResult = {
  messages: ParsedMessage[]
  ignoredLines: number
}

const fullLineRegex = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일\s*(오전|오후)\s*(\d{1,2}):(\d{2}),\s*(.+?)\s*:\s*(.*)$/
const dateOnlyRegex = /^(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일(?:\s+\S+요일)?$/
const bracketMessageRegex = /^(.*?)\s*\[(오전|오후)\s*(\d{1,2}):(\d{2})\]\s*(.*)$/

function to24Hour(ampm: string, hour: number) {
  if (ampm === '오전') return hour === 12 ? 0 : hour
  return hour === 12 ? 12 : hour + 12
}

function toTimestamp(year: number, month: number, day: number, ampm: string, hour: number, minute: number) {
  return Date.UTC(year, month - 1, day, to24Hour(ampm, hour), minute, 0, 0)
}

function toDatetimeLocalValue(ts: number) {
  const date = new Date(ts)
  const yyyy = date.getUTCFullYear()
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const min = String(date.getUTCMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

function parseDatetimeLocal(input: string) {
  if (!input) return undefined
  return new Date(`${input}:00Z`).getTime()
}

function parseKakaoText(raw: string): ParseResult {
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

function formatMessages(messages: ParsedMessage[]) {
  return messages
    .map((item) => `${item.author} : ${item.message}`)
    .join('\n')
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function App() {
  const [fileName, setFileName] = useState('')
  const [rawText, setRawText] = useState('')
  const [parseError, setParseError] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')

  const parsed = useMemo(() => {
    if (!rawText) return { messages: [], ignoredLines: 0 }
    try {
      return parseKakaoText(rawText)
    } catch (error) {
      const message = error instanceof Error ? error.message : '파싱 중 오류가 발생했어요.'
      setParseError(message)
      return { messages: [], ignoredLines: 0 }
    }
  }, [rawText])

  const filtered = useMemo(() => {
    const startTs = parseDatetimeLocal(startAt)
    const endTs = parseDatetimeLocal(endAt)

    return parsed.messages.filter((item) => {
      if (startTs !== undefined && item.timestamp < startTs) return false
      if (endTs !== undefined && item.timestamp > endTs) return false
      return true
    })
  }, [parsed.messages, startAt, endAt])

  const outputText = useMemo(() => formatMessages(filtered), [filtered])
  const lastDatetime = filtered.length > 0 ? filtered[filtered.length - 1].datetimeLabel : '없음'

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setParseError('')
    setFileName(file.name)
    const text = await file.text()
    setRawText(text)

    const tempParsed = parseKakaoText(text)
    if (tempParsed.messages.length > 0) {
      setStartAt((prev) => prev || toDatetimeLocalValue(tempParsed.messages[0].timestamp))
      setEndAt('')
    }
  }

  const handleDownload = () => {
    const suffix = startAt ? startAt.replace(/[:T]/g, '-') : 'all'
    downloadText(`kakao-filtered-${suffix}.txt`, outputText)
  }

  const rangeError = startAt && endAt && parseDatetimeLocal(startAt)! > parseDatetimeLocal(endAt)! ? '시작 시간이 종료 시간보다 늦어요.' : ''

  return (
    <div className="app-shell">
      <div className="card">
        <div className="eyebrow">KakaoTalk TXT Filter</div>
        <h1>카카오톡 메시지 정제 웹</h1>
        <p className="subtitle">
          txt를 올리면 날짜/시간 기준으로 메시지를 걸러서 <strong>이름 : 채팅</strong> 형식으로 다시 내려받을 수 있어.
        </p>

        <section className="section">
          <label className="upload-box">
            <input type="file" accept=".txt,text/plain" onChange={handleFileChange} />
            <span>{fileName ? `업로드됨: ${fileName}` : '카카오톡 내보내기 txt 업로드'}</span>
          </label>
        </section>

        <section className="section grid-two">
          <label>
            <span>시작 날짜/시간</span>
            <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </label>
          <label>
            <span>종료 날짜/시간 (선택)</span>
            <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
          </label>
        </section>

        {parseError ? <div className="alert error">{parseError}</div> : null}
        {rangeError ? <div className="alert error">{rangeError}</div> : null}

        <section className="section stats-grid">
          <div className="stat"><span>파싱된 메시지</span><strong>{parsed.messages.length}</strong></div>
          <div className="stat"><span>필터 결과</span><strong>{filtered.length}</strong></div>
          <div className="stat"><span>무시된 줄</span><strong>{parsed.ignoredLines}</strong></div>
          <div className="stat"><span>마지막 날짜시간</span><strong>{lastDatetime}</strong></div>
        </section>

        <section className="section">
          <div className="preview-header">
            <h2>결과 미리보기</h2>
            <button onClick={handleDownload} disabled={!outputText || !!rangeError}>txt 다운로드</button>
          </div>
          <textarea value={outputText} readOnly placeholder="필터된 결과가 여기 표시돼." />
        </section>
      </div>
    </div>
  )
}
