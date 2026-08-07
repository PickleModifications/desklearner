import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { getHighlighter, resolveLang, THEMES } from '../highlighter'
import { useUi } from '@/stores/ui'

const LABELS: Record<string, string> = {
  sql: 'T-SQL',
  python: 'Python',
  bash: 'Bash',
  powershell: 'PowerShell',
  json: 'JSON',
  yaml: 'YAML',
  docker: 'Dockerfile',
  csharp: 'C#',
  hcl: 'Terraform',
  text: ''
}

export function CodeBlock({
  code,
  lang,
  title
}: {
  code: string
  lang?: string
  title?: string
}): React.JSX.Element {
  const isDark = useUi((s) => s.isDark)
  const [html, setHtml] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const resolved = resolveLang(lang)

  useEffect(() => {
    let cancelled = false
    void getHighlighter()
      .then((hl) =>
        hl.codeToHtml(code, {
          lang: resolved,
          theme: isDark ? THEMES.dark : THEMES.light
        })
      )
      .then((out) => {
        if (!cancelled) setHtml(out)
      })
      .catch(() => {
        if (!cancelled) setHtml(null)
      })
    return () => {
      cancelled = true
    }
  }, [code, resolved, isDark])

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const label = title ?? LABELS[resolved] ?? resolved.toUpperCase()

  return (
    <div className="code-block">
      <div className="code-block__bar">
        <span className="truncate">{label}</span>
        <button
          className="btn btn-ghost h-6 !px-2 text-[11px]"
          onClick={() => void copy()}
          aria-label="Copy code"
        >
          {copied ? <Check size={12} style={{ color: 'var(--success)' }} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="code-block__body">
        {html ? (
          <div dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre>
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  )
}
