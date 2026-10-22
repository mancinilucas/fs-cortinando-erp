import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { Select, TextArea, TextField } from './FormFields'

test('connects label, hint, caller description and error to its control', async () => {
  render(<><p id="extra">Informação adicional</p><TextField id="name" label="Nome" hint="Nome completo" error="Informe o nome" aria-describedby="extra" required /></>)
  const input = screen.getByRole('textbox', { name: 'Nome' })
  expect(input).toBeRequired()
  expect(input).toHaveAttribute('aria-invalid', 'true')
  expect(input).toHaveAccessibleDescription('Informação adicional Nome completo Informe o nome')
  expect(screen.getByRole('alert')).toHaveTextContent('Informe o nome')
  await userEvent.setup().type(input, 'Maria')
  expect(input).toHaveValue('Maria')
})

test('generates distinct ids, preserves refs and removes old errors on rerender', () => {
  const ref = createRef<HTMLInputElement>()
  const { rerender } = render(<><TextField ref={ref} label="Nome" error="Obrigatório" /><TextField label="Telefone" /></>)
  expect(ref.current).toBe(screen.getByLabelText('Nome'))
  expect(screen.getByLabelText('Nome').id).not.toBe(screen.getByLabelText('Telefone').id)
  rerender(<TextField label="Nome" />)
  expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid')
  expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-describedby')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

test('preserves textarea editing and native select behavior', async () => {
  const user = userEvent.setup()
  render(<><TextArea label="Observações" /><Select label="Opção" hint="Escolha uma opção" error="Revise a opção" defaultValue="a"><option value="a">Primeira</option><option value="b">Segunda</option></Select></>)
  await user.type(screen.getByLabelText('Observações'), 'Linha 1{Enter}Linha 2')
  expect(screen.getByLabelText('Observações')).toHaveValue('Linha 1\nLinha 2')
  const select = screen.getByRole('combobox', { name: 'Opção' })
  await user.selectOptions(select, 'b')
  expect(select).toHaveValue('b')
  expect(select).toHaveAccessibleDescription('Escolha uma opção Revise a opção')
})

test('disabled controls cannot be edited or reached by Tab', async () => {
  const user = userEvent.setup()
  render(<><TextField label="Nome" disabled /><TextArea label="Notas" disabled /><Select label="Opção" disabled><option>Única</option></Select><TextField label="Disponível" /></>)
  await user.type(screen.getByLabelText('Nome'), 'blocked')
  expect(screen.getByLabelText('Nome')).toHaveValue('')
  expect(screen.getByLabelText('Notas')).toBeDisabled()
  expect(screen.getByRole('combobox')).toBeDisabled()
  await user.tab()
  expect(screen.getByLabelText('Disponível')).toHaveFocus()
})
