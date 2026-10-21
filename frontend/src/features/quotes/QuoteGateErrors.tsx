import type { ApiViolation } from '@/shared/errors/parse-api-error'

export function QuoteGateErrors({ violations }: { violations: readonly ApiViolation[] }) {
  const groups = new Map<string, ApiViolation[]>()
  for (const violation of violations) {
    const group = violation.curtainSequence ? `Cortina ${violation.curtainSequence}`
      : violation.code.startsWith('CURTAIN_') || violation.code === 'COMPONENT_INVALID' ? 'Cortinas e componentes'
        : violation.code === 'GENERAL_ADD_ON_INVALID' ? 'Adicionais gerais' : 'Dados do orçamento'
    groups.set(group, [...(groups.get(group) ?? []), violation])
  }
  return <div className="space-y-3">{[...groups].map(([label, items]) => <section key={label} aria-label={label}>
    <h3 className="font-semibold">{label}</h3><ul className="list-inside list-disc text-error-fg">{items.map((item, index) => <li key={index}>{item.message}</li>)}</ul>
  </section>)}</div>
}
