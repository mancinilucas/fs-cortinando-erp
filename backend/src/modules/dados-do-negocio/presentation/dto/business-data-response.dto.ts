// Public response for GET and PUT /dados-do-negocio (D131). The singleton id is
// internal and updatedAt is exposed as ISO 8601.
export class BusinessDataResponseDto {
  commercialNameOrConsultant: string;
  phone: string;
  email: string | null;
  taxId: string | null;
  updatedAt: string;
}
