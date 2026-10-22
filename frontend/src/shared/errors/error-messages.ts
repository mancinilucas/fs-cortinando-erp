export const GENERIC_ERROR_MESSAGE = 'Não foi possível concluir a operação. Tente novamente.'

const httpErrorMessages: Readonly<Record<number, string>> = {
  400: 'Confira os dados informados.',
  401: 'Não foi possível autenticar a solicitação.',
  403: 'Não foi possível validar a origem da solicitação. Verifique a configuração do ambiente.',
  404: 'O recurso solicitado não foi encontrado.',
  409: 'A operação não é permitida na situação atual. Atualize os dados.',
  422: 'Confira os dados e requisitos da operação.',
  429: 'Muitas solicitações. Aguarde um pouco e tente novamente.',
  500: GENERIC_ERROR_MESSAGE,
}

const knownMessages: Readonly<Record<string, string>> = {
  'Invalid origin': httpErrorMessages[403],
  'Customer not found': 'Cliente não encontrado.',
  'Quote not found': 'Orçamento não encontrado.',
  'Business data is not configured': 'Os dados do negócio ainda não foram configurados.',
  'Document data is incomplete': 'Faltam dados para gerar o documento.',
  'Document is not available in the current status': 'O documento não está disponível na situação atual.',
  'Could not generate the document': 'Não foi possível gerar o documento. Tente novamente.',
  'Quote can only be edited while in DRAFT or SENT status': 'O orçamento só pode ser editado como rascunho ou enviado.',
  'Unknown or duplicated quote item id': 'Um item do orçamento não foi reconhecido ou está duplicado. Atualize os dados.',
  'Quote has expired': 'O orçamento expirou. Renove a validade antes de confirmar.',
  'Quote cannot be confirmed without a validity': 'O orçamento precisa de uma validade antes da confirmação.',
  'Quote cannot be renewed without a validity': 'O orçamento não possui validade para renovação.',
  'Quote cannot be completed before the scheduled installation': 'A conclusão só é permitida após a instalação agendada.',
  'Quote transition is not allowed in the current status': 'A ação não é permitida na situação atual do orçamento.',
  'Quote does not satisfy the sending requirements': 'O orçamento ainda não atende aos requisitos de envio.',
}

export const gateViolationMessages = {
  TOTAL_OUT_OF_RANGE: 'Um valor do orçamento está fora da faixa permitida.',
  INSTALLATION_ADDRESS_INCOMPLETE: 'Preencha o endereço de instalação.',
  NO_CURTAINS: 'Inclua pelo menos uma cortina.',
  CURTAIN_ROOM_REQUIRED: 'Informe o ambiente da cortina.',
  CURTAIN_OPENING_WIDTH_INVALID: 'Confira a largura do vão da cortina.',
  CURTAIN_HEIGHT_INVALID: 'Confira a altura da cortina.',
  CURTAIN_BORDER_INVALID: 'Confira a borda da cortina.',
  CURTAIN_FABRIC_FACTOR_INVALID: 'Confira o fator de tecido da cortina.',
  CURTAIN_MATERIAL_REQUIRED: 'Informe o material da cortina.',
  CURTAIN_COMPONENT_REQUIRED: 'Inclua pelo menos um componente financeiro válido na cortina.',
  COMPONENT_INVALID: 'Confira os dados do componente financeiro.',
  GENERAL_ADD_ON_INVALID: 'Confira os dados do adicional geral.',
  DISCOUNT_EXCEEDS_SUBTOTAL: 'O desconto não pode ultrapassar o subtotal.',
  TOTAL_NOT_POSITIVE: 'O valor final do orçamento deve ser maior que zero.',
  VALID_UNTIL_NOT_FUTURE: 'Informe uma validade futura.',
  CUSTOMER_NOT_ACTIVE: 'O cliente do orçamento foi excluído.',
} satisfies Record<string, string>

export function getHttpErrorMessage(status: number): string {
  return Object.hasOwn(httpErrorMessages, status) ? httpErrorMessages[status] : GENERIC_ERROR_MESSAGE
}

export function getKnownErrorMessage(message: unknown): string {
  return typeof message === 'string' && Object.hasOwn(knownMessages, message)
    ? knownMessages[message] : GENERIC_ERROR_MESSAGE
}

export function getGateViolationMessage(code: string): string {
  const messages: Readonly<Record<string, string>> = gateViolationMessages
  return Object.hasOwn(messages, code) ? messages[code] : GENERIC_ERROR_MESSAGE
}
