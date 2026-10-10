import { MedicalCase } from '../types';

export const mockCases: MedicalCase[] = [
  {
    id: 'case-northline-001',
    patient_name: 'Alex Rivera',
    provider_name: 'Northline Medical Center',
    facility_type: 'Emergency Department Visit',
    service_date: 'Sep 18, 2026',
    statement_date: 'Oct 02, 2026',
    account_number: 'NMC-882941-09',
    status: 'needs_clarification',
    documents: [
      {
        id: 'doc-1',
        name: 'Northline-statement-sep18.pdf',
        type: 'bill',
        uploadDate: 'Oct 04, 2026',
        size: '1.4 MB'
      },
      {
        id: 'doc-2',
        name: 'BlueShield-EOB-Northline.pdf',
        type: 'eob',
        uploadDate: 'Oct 04, 2026',
        size: '890 KB'
      }
    ],
    total_billed: 2670.00,
    insurer_adjustments: 1440.00,
    insurer_paid: 686.00,
    patient_paid: 50.00,
    statement_balance: 494.00,
    eob_responsibility: 294.00,
    derived_remaining: 244.00,
    discrepancy_amount: 250.00,
    follow_up_date: 'Oct 16, 2026',
    notes: 'Awaiting billing department phone response regarding duplicate CPT 80053 and uncredited $50 copay.',
    line_items: [
      {
        id: 'item-1',
        cpt_code: '99284',
        description: 'Emergency department visit, high severity',
        description_es: 'Visita al departamento de emergencias, gravedad alta',
        quantity: 1,
        hospital_amount: 1670.00,
        benchmark_allowed: 820.00,
        status: 'clean'
      },
      {
        id: 'item-2',
        cpt_code: '70450',
        description: 'CT scan head/brain without contrast',
        description_es: 'Tomografía computarizada de cabeza/cerebro sin contraste',
        quantity: 1,
        hospital_amount: 500.00,
        benchmark_allowed: 420.00,
        status: 'clean'
      },
      {
        id: 'item-3',
        cpt_code: '80053',
        description: 'Comprehensive metabolic panel (Entry 1)',
        description_es: 'Panel metabólico integral (Entrada 1)',
        quantity: 1,
        hospital_amount: 250.00,
        benchmark_allowed: 68.00,
        status: 'duplicate',
        flag_reason: 'Line appears twice on statement with identical date, but EOB authorizes only 1 unit.',
        flag_reason_es: 'Esta línea aparece dos veces en el estado de cuenta con fecha idéntica, pero la EOB autoriza solo 1 unidad.'
      },
      {
        id: 'item-4',
        cpt_code: '80053',
        description: 'Comprehensive metabolic panel (Entry 2 - Duplicate)',
        description_es: 'Panel metabólico integral (Entrada 2 - Duplicado)',
        quantity: 1,
        hospital_amount: 250.00,
        benchmark_allowed: 0.00,
        status: 'flagged',
        flag_reason: 'Suspected duplicate billing. EOB does not recognize second unit.',
        flag_reason_es: 'Sospecha de facturación duplicada. La EOB no reconoce la segunda unidad.'
      }
    ],
    findings: [
      {
        id: 'find-1',
        title: 'Laboratory line CPT 80053 appears twice',
        title_es: 'La línea de laboratorio CPT 80053 aparece dos veces',
        severity: 'high',
        category: 'duplicate_charge',
        cpt_code: '80053',
        summary: 'Two metabolic panel entries are billed for the same visit ($250 each). EOB confirms only 1 unit performed.',
        summary_es: 'Se facturan dos paneles metabólicos para la misma visita ($250 c/u). La EOB confirma solo 1 unidad realizada.',
        explanation: 'Your hospital statement lists code 80053 twice on September 18th for $250.00 each. However, your insurer’s Explanation of Benefits (EOB) shows that only one comprehensive metabolic panel was authorized. This is a common administrative duplicate entry.',
        explanation_es: 'El estado de cuenta de su hospital incluye el código 80053 dos veces el 18 de septiembre por $250.00 cada uno. Sin embargo, la Explicación de Beneficios (EOB) de su aseguradora muestra que solo se autorizó un panel metabólico.',
        evidence_quote: 'STATEMENT: Line 3 (CPT 80053 - $250.00) & Line 4 (CPT 80053 - $250.00) | EOB: Claim #99412 Allowed: 1 Unit ($68.00)',
        comparison_basis: 'Discrepancy: $250.00 potential overcharge',
        comparison_basis_es: 'Discrepancia: $250.00 de posible sobrecargo',
        question_for_billing: '“Do these two CPT 80053 entries represent two distinct blood draws at different times, or is this an accidental duplicate entry on statement #NMC-882941-09?”',
        question_for_billing_es: '“¿Estas dos entradas CPT 80053 representan dos extracciones distintas en diferentes horarios, o es un cargo duplicado involuntario en el estado de cuenta #NMC-882941-09?”',
        statutory_rule: 'Billing Compliance Rule: CMS National Correct Coding Initiative (NCCI) prohibits unbundled duplicate panel billing.',
        statutory_rule_es: 'Norma de cumplimiento: La Iniciativa Nacional de Codificación Correcta de CMS (NCCI) prohíbe la facturación duplicada de paneles.',
        potential_savings: 250.00
      },
      {
        id: 'find-2',
        title: 'Statement balance ($494) does not match EOB responsibility ($244)',
        title_es: 'El saldo del estado ($494) no coincide con la responsabilidad de la EOB ($244)',
        severity: 'high',
        category: 'balance_discrepancy',
        summary: 'Your insurer determined your out-of-pocket maximum responsibility is $294.00, minus your $50 emergency copay already paid.',
        summary_es: 'Su aseguradora determinó que su responsabilidad es de $294.00, menos su copago de $50 ya pagado.',
        explanation: 'After contractual network discounts and insurer payments, your insurer EOB states your total remaining responsibility is $294.00. Because you already paid a $50 copay at check-in (documented on page 1 of your receipt), your true owed amount should be $244.00, not $494.00.',
        explanation_es: 'Después de los descuentos contractuales y pagos del seguro, su EOB indica una responsabilidad de $294.00. Como ya pagó un copago de $50 al ingresar, el saldo real debería ser $244.00 y no $494.00.',
        evidence_quote: 'Formula: EOB Allowed ($294.00) − Prior Copay ($50.00) = $244.00 | Statement Demands: $494.00 ($250.00 discrepancy)',
        comparison_basis: 'Calculation verified against BlueShield Explanation of Benefits dated Sep 24, 2026',
        comparison_basis_es: 'Cálculo verificado con la Explicación de Beneficios de BlueShield con fecha del 24 de sep. de 2026',
        question_for_billing: '“Has your office posted the $1,440.00 network adjustment and my $50 copay receipt from September 18th to account #NMC-882941-09?”',
        question_for_billing_es: '“¿Ha registrado su oficina el ajuste de red de $1,440.00 y mi recibo de copago de $50 del 18 de septiembre en la cuenta #NMC-882941-09?”',
        statutory_rule: 'Statutory Protection: Under the No Surprises Act, in-network facilities may not balance-bill patients beyond the EOB member responsibility.',
        statutory_rule_es: 'Protección legal: Según la Ley No Surprises Act, los centros dentro de la red no pueden facturar saldos por encima de la responsabilidad del miembro en la EOB.',
        potential_savings: 250.00
      }
    ],
    dispute_letter_recipient: 'billing',
    dispute_letter_draft: `Date: October 9, 2026
To: Northline Medical Center — Patient Financial Services
Account Number: NMC-882941-09
Patient Name: Alex Rivera
Date of Service: September 18, 2026

RE: Request for Itemized Billing Reconciliation & Correction of Discrepancies

Dear Billing Department,

I am writing to formally request clarification and an audit adjustment regarding statement #NMC-882941-09, which lists an outstanding balance of $494.00. Upon cross-referencing this statement with my BlueShield Explanation of Benefits (Claim #99412), I identified the following material discrepancies:

1. Duplicate Laboratory Charge (CPT 80053):
The statement itemizes CPT 80053 (Comprehensive Metabolic Panel) twice at $250.00 each for the same date of service. My insurer's EOB adjudicates only one unit of this service. Please review the clinical record to determine whether this was an accidental duplicate entry and credit $250.00 accordingly.

2. Patient Balance Mismatch & Uncredited Copayment:
The insurer's final EOB establishes patient financial responsibility at $294.00. Furthermore, I tendered a $50.00 emergency facility copay on September 18, 2026 (Receipt #REC-55102), which does not appear reflected on the statement. Per federal balance-billing regulations, my remaining balance should not exceed $244.00 ($294.00 EOB responsibility minus $50.00 prior payment).

Pursuant to the No Surprises Act (45 CFR § 149) and patient billing transparency rules, I request that you place this account on a 30-day administrative hold, correct the ledger, and provide a revised statement reflecting the true reconciled balance of $244.00.

Thank you for your prompt attention to this matter.

Sincerely,
Alex Rivera
Contact: alex.rivera@example.com`,

    dispute_letter_draft_es: `Fecha: 9 de octubre de 2026
Para: Northline Medical Center — Servicios Financieros al Paciente
Número de Cuenta: NMC-882941-09
Nombre del Paciente: Alex Rivera
Fecha del Servicio: 18 de septiembre de 2026

ASUNTO: Solicitud de Conciliación de Facturación y Corrección de Discrepancias

Estimado Departamento de Facturación:

Me dirijo a ustedes para solicitar formalmente una aclaración y ajuste respecto al estado de cuenta #NMC-882941-09, el cual indica un saldo pendiente de $494.00. Al cotejar este estado con mi Explicación de Beneficios de BlueShield (Reclamo #99412), he identificado las siguientes discrepancias:

1. Cargo Duplicado de Laboratorio (CPT 80053):
El estado incluye el código CPT 80053 dos veces a $250.00 cada uno para la misma fecha. La EOB de mi seguro autoriza únicamente una unidad. Solicito una revisión de la historia clínica para anular el cargo duplicado de $250.00.

2. Discrepancia de Saldo y Copago No Acreditado:
La EOB establece mi responsabilidad máxima en $294.00. Además, aboné un copago de $50.00 el 18 de septiembre (Recibo #REC-55102). Conforme a las normativas vigentes, mi saldo pendiente no debe exceder los $244.00.

Solicito respetuosamente que pongan esta cuenta en pausa administrativa por 30 días mientras se emite el estado de cuenta corregido.

Atentamente,
Alex Rivera`,

    call_script: `Call Script for Northline Billing Department (Phone: 1-800-555-0199)

Before You Call:
• Have Statement #NMC-882941-09 and EOB Claim #99412 in front of you.
• Have pen and paper ready to log the representative's name and reference number.

Step 1: Introduction
“Hello, my name is Alex Rivera. I am calling regarding statement #NMC-882941-09 for date of service September 18th. I need to review two specific billing discrepancies before making payment.”

Step 2: Ask for Details
• “First, my statement lists CPT 80053 (Metabolic Panel) twice for $250 each. My insurance EOB shows only one was authorized. Can you check whether this was entered twice by mistake?”
• “Second, my EOB states my patient responsibility is $294, and I already paid a $50 copay at the hospital. Why does this bill ask for $494 instead of $244?”

Step 3: Action & Hold
• “Can you place a 30-day hold on this account while your billing team reviews the duplicate CPT 80053 charge?”
• “May I have your name, employee ID, and a reference ticket number for this call?”`,

    call_script_es: `Guión de Llamada para el Departamento de Facturación de Northline

Antes de llamar:
• Tenga a mano el Estado de cuenta #NMC-882941-09 y la EOB Reclamo #99412.
• Tenga papel y lápiz para anotar el nombre del representante y número de referencia.

Paso 1: Saludo e Identificación
“Hola, mi nombre es Alex Rivera. Llamo con respecto al estado de cuenta #NMC-882941-09 del 18 de septiembre. Necesito revisar dos discrepancias antes de efectuar el pago.”

Paso 2: Explicar las Discrepancias
• “En primer lugar, mi estado de cuenta enumera el código CPT 80053 dos veces por $250 cada uno. La EOB de mi seguro solo autorizó una unidad. ¿Podrían verificar si se trató de un cargo duplicado?”
• “En segundo lugar, la EOB indica que mi responsabilidad es $294, y ya pagué un copago de $50. ¿Por qué el saldo refleja $494 en vez de $244?”

Paso 3: Solicitar Pausa y Registro
• “¿Podrían poner una pausa de 30 días en esta cuenta mientras revisan el cargo?”
• “¿Me podría dar su nombre y número de referencia para este reclamo?”`,

    audio_summary_script: `Your medical bill from Northline Medical Center asks for $494.00, but our forensic audit identified a $250.00 discrepancy. First, code 80053 for a metabolic panel appears twice on your hospital bill at $250.00 each, even though your insurance explanation of benefits only authorizes one test. Second, your insurer determined your true patient responsibility is $294.00, and you already paid a $50 copay on the day of your visit. Your reconciled remaining balance should be $244.00, not $494.00. We have prepared an itemized dispute letter and phone script for you to request this correction.`,

    audio_summary_script_es: `El estado de cuenta de Northline Medical Center solicita $494.00, pero nuestra auditoría forense identificó una discrepancia de $250.00. Primero, el código 80053 para un panel metabólico aparece dos veces facturado a $250.00 cada uno, a pesar de que su seguro solo autorizó una prueba. Segundo, su aseguradora determinó que su responsabilidad real es de $294.00, y usted ya pagó un copago de $50. Su saldo restante conciliado debe ser de $244.00 y no de $494.00. Hemos preparado una carta de disputa y un guión de llamada para solicitar esta corrección.`
  },
  {
    id: 'case-imaging-002',
    patient_name: 'Elena Vance',
    provider_name: 'Metro Advanced MRI & Radiology',
    facility_type: 'Outpatient Imaging Diagnostic',
    service_date: 'Aug 24, 2026',
    statement_date: 'Sep 10, 2026',
    account_number: 'MDI-44102-BR',
    status: 'in_dispute',
    documents: [
      {
        id: 'doc-3',
        name: 'MetroMRI-Invoice-Aug24.pdf',
        type: 'bill',
        uploadDate: 'Sep 12, 2026',
        size: '2.1 MB'
      }
    ],
    total_billed: 3100.00,
    insurer_adjustments: 800.00,
    insurer_paid: 1100.00,
    patient_paid: 0.00,
    statement_balance: 1200.00,
    eob_responsibility: 450.00,
    derived_remaining: 450.00,
    discrepancy_amount: 750.00,
    follow_up_date: 'Oct 22, 2026',
    notes: 'Snowflake healthcare benchmark flags regional markup at 410% above median Medicare allowable.',
    line_items: [
      {
        id: 'item-201',
        cpt_code: '70553',
        description: 'MRI Brain with and without contrast',
        description_es: 'Resonancia magnética cerebral con y sin contraste',
        quantity: 1,
        hospital_amount: 2850.00,
        benchmark_allowed: 450.00,
        status: 'flagged',
        flag_reason: 'Facility fee billed outside in-network contract schedule.',
        flag_reason_es: 'Tarifa de instalación facturada fuera del baremo contractual dentro de la red.'
      },
      {
        id: 'item-202',
        cpt_code: 'A9579',
        description: 'Gadolinium based magnetic resonance contrast agent',
        description_es: 'Agente de contraste de resonancia a base de gadolinio',
        quantity: 1,
        hospital_amount: 250.00,
        benchmark_allowed: 35.00,
        status: 'clean'
      }
    ],
    findings: [
      {
        id: 'find-201',
        title: 'Out-of-Network Balance Billing Violation (No Surprises Act)',
        title_es: 'Violación de Facturación de Saldo Fuera de Red (No Surprises Act)',
        severity: 'high',
        category: 'balance_discrepancy',
        cpt_code: '70553',
        summary: 'Radiology provider billed $1,200 balance after insurer paid in-network rate for emergency referral.',
        summary_es: 'El radiólogo facturó $1,200 de saldo restante después del pago de tarifa en red por derivación médica.',
        explanation: 'Because this diagnostic MRI was ordered by an in-network hospital physician, federal protections protect you from balance billing greater than your in-network cost-sharing ($450.00).',
        explanation_es: 'Dado que esta resonancia fue indicada por un médico dentro de la red, las protecciones federales le amparan frente a facturaciones adicionales.',
        evidence_quote: 'NO SURPRISES ACT: Out-of-network auxiliary providers at in-network facilities cannot balance-bill patients.',
        comparison_basis: 'Regional Snowflake benchmark shows Medicare fee schedule max is $450.00 for ZIP 10016',
        comparison_basis_es: 'El índice Snowflake regional demuestra que la tarifa de Medicare es de $450.00 para el CP 10016',
        question_for_billing: '“Under federal No Surprises Act regulations, please adjust the out-of-network balance to match my in-network copay responsibility.”',
        question_for_billing_es: '“Bajo las regulaciones de la Ley No Surprises Act, solicito ajustar el saldo al copago dentro de la red correspondiente.”',
        statutory_rule: '45 CFR § 149.410 — Balance Billing Protections for Non-Emergency Services',
        statutory_rule_es: '45 CFR § 149.410 — Protecciones contra facturación de saldo en servicios médicos',
        potential_savings: 750.00
      }
    ],
    dispute_letter_recipient: 'billing',
    dispute_letter_draft: `Date: October 9, 2026\nTo: Metro Advanced Radiology Billing Office\nAccount: MDI-44102-BR\nPatient: Elena Vance\n\nRE: Formal Dispute under the Federal No Surprises Act\n\nDear Billing Office,\n\nI am writing to dispute the balance billing charge of $750.00 on statement #MDI-44102-BR. This imaging procedure was performed following a direct physician order at an in-network facility. Under 45 CFR § 149, you are prohibited from balance-billing patients beyond in-network cost-sharing. Please adjust the account to reflect the EOB responsibility of $450.00.\n\nSincerely,\nElena Vance`,
    dispute_letter_draft_es: `Fecha: 9 de octubre de 2026\nPara: Oficina de Facturación de Metro Advanced Radiology\nCuenta: MDI-44102-BR\nPaciente: Elena Vance\n\nASUNTO: Disputa Formal bajo la Ley No Surprises Act\n\nEstimada Oficina de Facturación,\n\nLe escribo para disputar el cobro de saldo por $750.00. Conforme a las regulaciones federales, está prohibido facturar importes superiores a la cobertura dentro de la red. Solicito ajustar el saldo a $450.00.\n\nAtentamente,\nElena Vance`,
    call_script: `Call Script for Metro Radiology Billing: Quote 45 CFR § 149 and request in-network adjustment.`,
    call_script_es: `Guión de llamada para Metro Radiology: Citar la regulación 45 CFR § 149 y solicitar ajuste a tarifa en red.`,
    audio_summary_script: `Your imaging statement contains an unlawful balance billing charge of $750.00 under the No Surprises Act.`,
    audio_summary_script_es: `Su factura de radiología contiene un cargo indebido de $750.00 amparado por la ley No Surprises Act.`
  }
];
