import { useMemo, useState } from 'react'
import {
  formatMessages,
  parseDatetimeLocal,
  parseKakaoText,
  toDatetimeLocalValue,
} from './lib/parser'

export default function App() {
  const [fileName, setFileName] = useState('')
  const [rawText, setRawText] = useState('')
  const [parseError, setParseError] = useState('')
  const [startAt, setStartAt] = useState('')
  const [endAt, setEndAt] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const parsed = useMemo(() => {
    if (!rawText) return { messages: [], ignoredLines: 0 }
    try {
      setParseError('')
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
  const rangeError = startAt && endAt && parseDatetimeLocal(startAt)! > parseDatetimeLocal(endAt)! ? '시작 시간이 종료 시간보다 늦어요.' : ''

  const loadFile = async (file: File) => {
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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await loadFile(file)
  }

  const handleDrop = async (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    await loadFile(file)
  }

  const handleDownload = () => {
    const suffix = startAt ? startAt.replace(/[:T]/g, '-') : 'all'
    const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kakao-filtered-${suffix}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app-shell">
      <div className="card">
        <div className="eyebrow">KakaoTalk TXT Filter</div>
        <h1>카카오톡 메시지 정제 웹</h1>
        <p className="subtitle">
          txt를 올리면 날짜/시간 기준으로 메시지를 걸러서 <strong>이름 : 채팅</strong> 형식으로 다시 내려받을 수 있어.
        </p>

        <section className="section">
          <label
            className={`upload-box ${isDragging ? 'dragging' : ''}`}
            onDragEnter={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              setIsDragging(false)
            }}
            onDrop={handleDrop}
          >
            <input type="file" accept=".txt,text/plain" onChange={handleFileChange} />
            <span>
              {fileName
                ? `업로드됨: ${fileName}`
                : '카카오톡 내보내기 txt 업로드 또는 여기로 드래그앤드롭'}
            </span>
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
