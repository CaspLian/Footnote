import { GlossaryTerm } from '../types';

export const glossaryTerms: GlossaryTerm[] = [
  {
    term: 'Explanation of Benefits (EOB)',
    term_es: 'Explicación de Beneficios (EOB)',
    category: 'insurance',
    definition: 'A document sent by your health insurer explaining what medical procedures were billed, what the plan paid, and what your actual financial responsibility is. An EOB is NOT a bill.',
    definition_es: 'Un documento enviado por su aseguradora médica que detalla los servicios facturados, lo que pagó el plan y su responsabilidad financiera real. Una EOB NO es una factura.',
    example: 'Always compare the "Member Responsibility" amount on your EOB with the "Patient Balance" on the hospital statement.',
    example_es: 'Siempre compare el monto de "Responsabilidad del Afiliado" de su EOB con el "Saldo del Paciente" en el estado de cuenta del hospital.'
  },
  {
    term: 'No Surprises Act (45 CFR § 149)',
    term_es: 'Ley No Surprises Act (45 CFR § 149)',
    category: 'rights',
    definition: 'Federal legislation that protects patients from unexpected medical bills when receiving emergency care, air ambulance transport, or non-emergency care from out-of-network doctors at in-network hospitals.',
    definition_es: 'Legislación federal que protege a los pacientes contra facturas médicas sorpresa en atención de urgencia, ambulancias aéreas o servicios fuera de red en centros dentro de la red.',
    example: 'Under this federal law, you cannot be balance-billed for emergency facility fees beyond your in-network copay or deductible.',
    example_es: 'Bajo esta ley federal, no se le pueden cobrar saldos adicionales por tarifas de urgencia más allá de su copago o deducible dentro de la red.'
  },
  {
    term: 'Balance Billing',
    term_es: 'Facturación de Saldo (Balance Billing)',
    category: 'billing',
    definition: 'When a healthcare provider bills a patient for the difference between the total provider fee and the insurer-approved allowable amount. Often unlawful for in-network care.',
    definition_es: 'Cuando un proveedor médico factura al paciente la diferencia entre el cargo total y el monto permitido por la aseguradora. Con frecuencia es indebido en centros de la red.',
    example: 'If an in-network provider bills $1,000 and the insurer allows $400, the provider must write off $600 rather than demanding it from the patient.',
    example_es: 'Si un proveedor en red cobra $1,000 y el seguro autoriza $400, el proveedor debe absorber los $600 restantes y no cobrárselos al paciente.'
  },
  {
    term: 'CPT Code Unbundling',
    term_es: 'Desagregación de Códigos CPT (Unbundling)',
    category: 'billing',
    definition: 'A billing practice where components of a comprehensive medical procedure that should be billed under a single package code are separated into individual line items to inflate charges.',
    definition_es: 'Práctica de facturación donde partes de un procedimiento que deberían cobrarse bajo un solo código integral se desglosan por separado para inflar el monto.',
    example: 'Billing routine blood draw venipuncture (CPT 36415) separately during a comprehensive surgical procedure.',
    example_es: 'Facturar la extracción de sangre de rutina (CPT 36415) por separado durante un procedimiento quirúrgico integral.'
  },
  {
    term: 'Out-of-Pocket Maximum',
    term_es: 'Límite Máximo de Gasto de su Bolsillo',
    category: 'insurance',
    definition: 'The most you have to pay for covered services in a plan year. After you spend this amount on deductibles, copayments, and coinsurance, your health plan pays 100% of the costs.',
    definition_es: 'El monto máximo que debe pagar por servicios cubiertos en un año de plan. Una vez alcanzado, el plan cubre el 100% de los costos elegibles.',
    example: 'If your out-of-pocket maximum was reached on August 12, any subsequent in-network care that year must be covered at 100%.',
    example_es: 'Si alcanzó su gasto máximo el 12 de agosto, toda atención médica posterior dentro de la red ese año debe cubrirse al 100%.'
  },
  {
    term: 'Coinsurance vs. Copayment',
    term_es: 'Coseguro vs. Copago',
    category: 'insurance',
    definition: 'A copayment is a fixed dollar fee (e.g., $50 for an ER visit). Coinsurance is your percentage share of the allowed cost of a healthcare service (e.g., 20% after meeting deductible).',
    definition_es: 'Un copago es una tarifa fija en dólares (ej. $50 por visita de urgencia). El coseguro es su porcentaje del costo permitido (ej. 20% tras cubrir el deducible).',
    example: 'Paying a $50 copay at the front desk reduces your final billed responsibility.',
    example_es: 'Pagar un copago de $50 en recepción reduce directamente el saldo final que le corresponde abonar.'
  },
  {
    term: 'Facility Fee',
    term_es: 'Tarifa de Instalación (Facility Fee)',
    category: 'billing',
    definition: 'An administrative charge added by hospital-owned clinics or emergency departments solely for the overhead cost of using the physical building and equipment.',
    definition_es: 'Un cargo administrativo que aplican los centros u hospitales por el uso del edificio, tecnología e infraestructura física.',
    example: 'Facility fees are frequently billed without prior disclosure and can be challenged if clinical care was minor.',
    example_es: 'Las tarifas de instalación a menudo se cobran sin previo aviso y pueden disputarse si la atención clínica fue de baja complejidad.'
  }
];
