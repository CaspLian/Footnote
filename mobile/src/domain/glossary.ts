import type { GlossaryTerm } from './types';

/** Plain-language paraphrases; the plan's own terms govern. Sources checked 2026-10-09. */
export const glossary: GlossaryTerm[] = [
  {
    id: 'eob', title: { en: 'Explanation of benefits', es: 'Explicación de beneficios' },
    definition: { en: 'A summary from your insurer explaining how a claim was processed: the charges, plan payment and your responsibility. The provider sends a separate bill.', es: 'Un resumen de tu aseguradora que explica cómo se procesó una reclamación: los cargos, el pago del plan y tu responsabilidad. El proveedor envía una factura por separado.' },
    example: { en: 'In the sample, the EOB lists $294 as the patient responsibility.', es: 'En el ejemplo, la EOB indica $294 como responsabilidad del paciente.' },
    source: { title: 'CMS · Reading your medical bill', url: 'https://www.cms.gov/files/document/nosurpriseactfactsheet-how-do-i-read-my-medical-bill508c.pdf' },
  },
  {
    id: 'allowed-amount', title: { en: 'Allowed amount', es: 'Importe permitido' },
    definition: { en: 'The amount your plan recognizes for a covered service. Your plan and the provider may divide this amount between insurer payment and patient responsibility.', es: 'El importe que tu plan reconoce para un servicio cubierto. Este importe puede dividirse entre el pago de la aseguradora y la responsabilidad del paciente.' },
    example: { en: 'The sample EOB allows $980: $686 paid by the plan and $294 assigned to the patient.', es: 'La EOB del ejemplo permite $980: el plan paga $686 y asigna $294 al paciente.' },
    source: { title: 'HealthCare.gov · Allowed amount', url: 'https://www.healthcare.gov/glossary/allowed-amount/' },
  },
  {
    id: 'deductible', title: { en: 'Deductible', es: 'Deducible' },
    definition: { en: 'An amount you pay for certain covered care before the plan starts sharing those costs. Some services may be covered before you meet it; check your plan.', es: 'Un importe que pagas por ciertos servicios cubiertos antes de que el plan empiece a compartir esos costos. Algunos servicios pueden estar cubiertos antes de alcanzarlo; consulta tu plan.' },
    example: { en: 'A plan with a $1,000 deductible may require you to pay the first $1,000 of care subject to that deductible.', es: 'Un plan con un deducible de $1,000 puede exigir que pagues los primeros $1,000 de los servicios sujetos a ese deducible.' },
    source: { title: 'HealthCare.gov · Deductible', url: 'https://www.healthcare.gov/glossary/deductible/' },
  },
  {
    id: 'coinsurance', title: { en: 'Coinsurance', es: 'Coseguro' },
    definition: { en: 'Your percentage share of the cost of a covered service, usually after the deductible. It is commonly calculated from the allowed amount.', es: 'Tu porcentaje del costo de un servicio cubierto, normalmente después del deducible. Suele calcularse a partir del importe permitido.' },
    example: { en: 'In the synthetic sample, 30% of the $980 allowed amount is $294.', es: 'En el ejemplo ficticio, el 30% del importe permitido de $980 es $294.' },
    source: { title: 'HealthCare.gov · Coinsurance', url: 'https://www.healthcare.gov/glossary/co-insurance/' },
  },
  {
    id: 'copayment', title: { en: 'Copayment', es: 'Copago' },
    definition: { en: 'A fixed amount you pay for a covered service. The amount and when it applies depend on your plan and the service.', es: 'Un importe fijo que pagas por un servicio cubierto. El importe y cuándo se aplica dependen de tu plan y del servicio.' },
    example: { en: 'Your plan might list a $25 copayment for a covered office visit.', es: 'Tu plan podría indicar un copago de $25 para una consulta cubierta.' },
    source: { title: 'HealthCare.gov · Copayment', url: 'https://www.healthcare.gov/glossary/co-payment/' },
  },
  {
    id: 'in-network', title: { en: 'In network', es: 'Dentro de la red' },
    definition: { en: 'A provider that has a contract with your health plan. Your share of covered costs is usually lower with providers in the plan’s network.', es: 'Un proveedor que tiene un contrato con tu plan de salud. Tu parte de los costos cubiertos suele ser menor con los proveedores de la red del plan.' },
    example: { en: 'Confirm that both the facility and each clinician participate in your plan.', es: 'Confirma que tanto el centro como cada profesional participen en tu plan.' },
    source: { title: 'HealthCare.gov · Health coverage glossary', url: 'https://www.healthcare.gov/SBC-GLOSSARY/' },
  },
  {
    id: 'itemized-bill', title: { en: 'Itemized bill', es: 'Factura detallada' },
    definition: { en: 'A bill listing individual services or supplies and their charges. It helps you compare what the provider billed with the services shown on your EOB.', es: 'Una factura que enumera cada servicio o suministro y sus cargos. Ayuda a comparar lo que facturó el proveedor con los servicios que aparecen en tu EOB.' },
    example: { en: 'Ask the billing office for service dates, procedure codes, units and adjustments.', es: 'Pide a facturación las fechas, los códigos de procedimiento, las unidades y los ajustes.' },
    source: { title: 'CMS · Reading your medical bill', url: 'https://www.cms.gov/files/document/nosurpriseactfactsheet-how-do-i-read-my-medical-bill508c.pdf' },
  },
  {
    id: 'appeal', title: { en: 'Appeal', es: 'Apelación' },
    definition: { en: 'A request for your insurer to review a decision denying a benefit or payment. Follow the instructions and any deadlines in your plan’s decision notice.', es: 'Una solicitud para que tu aseguradora revise una decisión que negó un beneficio o un pago. Sigue las instrucciones y los plazos del aviso de decisión de tu plan.' },
    example: { en: 'A duplicate provider charge may call for a billing correction; an insurer denial may call for an appeal.', es: 'Un cargo repetido del proveedor puede requerir una corrección de factura; una denegación de la aseguradora puede requerir una apelación.' },
    source: { title: 'HealthCare.gov · Appeal', url: 'https://www.healthcare.gov/glossary/appeal/' },
  },
];

export function searchGlossary(query: string, language: 'en' | 'es', translate: (text: string) => string = text => text): GlossaryTerm[] {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
  const needle = normalize(query.trim());
  return glossary.filter(term => normalize(`${translate(term.title.en)} ${translate(term.definition.en)} ${term.title[language]} ${term.definition[language]} ${term.id}`).includes(needle));
}
