import type { Finding, LineItem } from '../domain/types';

type Translate = (text: string, values?: Record<string, string | number>) => string;

/** Localize app-authored comparison text while preserving source descriptions, codes and amounts. */
export function findingCopy(finding: Finding, line: LineItem | undefined, t: Translate) {
  const comparison = finding.comparison;
  if (!finding.id.startsWith('price-') || !comparison || !line?.code) return {
    title: t(finding.title.en), explanation: t(finding.explanation.en), question: t(finding.question.en),
  };
  const service = line.description.en || line.code;
  const ratio = line.billedCents / comparison.amountCents;
  const times = ratio >= 10 ? ratio.toFixed(0) : ratio.toFixed(1);
  const units = line.units > 1 ? t('For {0} units.', {0:line.units}) : '';
  const context = comparison.doctorOnly
    ? t("What Medicare pays nationally for the doctor's part of this service. The hospital's part is not included, so this cannot show whether the hospital charge is high.")
    : t('What Medicare pays nationally for this service. Private insurers and providers often charge more; it is a reference, not what you owe.');
  return {
    title: comparison.doctorOnly
      ? t("{0}: Medicare's reference covers only the doctor's part", {0:service})
      : t("{0} is billed at about {1} times Medicare's rate", {0:service,1:times}),
    explanation: [context, units, comparison.doctorOnly
      ? t('This reference is not proof of an error or a fair hospital price.')
      : t('A difference is a reason to ask, not proof of an error.')].filter(Boolean).join(' '),
    question: comparison.doctorOnly
      ? t("Can you separate the doctor's charge and the hospital's charge for code {0} on an itemized statement?", {0:line.code})
      : t('Can you explain how the charge for code {0} was priced, and send an itemized statement?', {0:line.code}),
  };
}
