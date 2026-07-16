"use client";

import {
  AlertTriangle,
  Clock,
  Droplets,
  FileText,
  Pill,
  ShieldAlert,
  Utensils,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ageOf, evaluateEligibility } from "@/lib/eligibility";
import { useDomain, useFormat } from "@/lib/i18n/use-format";
import { useLabels } from "@/lib/i18n/use-labels";
import { serviceNamed } from "@/components/booking/service-picker";
import type {
  EligibilityRules,
  EligibilityViolation,
  PatientProfile,
  PreparationInstructions,
  Service,
} from "@/lib/types";

export interface AcknowledgementState {
  preparationAccepted: boolean;
  eligibilityConfirmed: boolean;
}

function preparationOf(service: Service): PreparationInstructions | undefined {
  return "preparation" in service ? service.preparation : undefined;
}

function rulesOf(service: Service): EligibilityRules | undefined {
  return "eligibility" in service ? service.eligibility : undefined;
}

/**
 * Step 3 — preparation & eligibility (§3).
 *
 * Where a service carries preparation instructions or eligibility rules, this
 * step is mandatory and blocking: an ineligible profile can never continue, and
 * an eligible one only continues after an explicit, two-part acknowledgement.
 * This is what stops a patient arriving un-fasted, or booking a scan they
 * cannot have.
 *
 * The *decision* still comes from `evaluateEligibility` — the rules live in the
 * domain, not here. Only the wording of each restriction and violation is
 * rebuilt for the active locale, because the domain speaks English.
 */
export function PreparationStep({
  service,
  profile,
  value,
  onChange,
  onChangeProfile,
  onChangeService,
}: {
  service: Service;
  profile: PatientProfile;
  value: AcknowledgementState;
  onChange: (next: AcknowledgementState) => void;
  onChangeProfile: () => void;
  onChangeService: () => void;
}) {
  const t = useTranslations("booking");
  const { localized, named } = useDomain();
  const { formatNumber } = useFormat();
  const L = useLabels();

  const prep = preparationOf(service);
  const rules = rulesOf(service);
  const result = evaluateEligibility(service, profile);

  const serviceName = named(serviceNamed(service));
  const age = ageOf(profile.dateOfBirth);

  /** The service's restrictions, in the reader's language. */
  const restrictions: string[] = [];
  if (rules) {
    if (rules.genders?.length === 1) {
      restrictions.push(
        rules.genders[0] === "male"
          ? t("prep.restriction.menOnly")
          : t("prep.restriction.womenOnly"),
      );
    }
    if (rules.minAge !== undefined && rules.maxAge !== undefined) {
      restrictions.push(
        t("prep.restriction.ageRange", {
          min: formatNumber(rules.minAge),
          max: formatNumber(rules.maxAge),
        }),
      );
    } else if (rules.minAge !== undefined) {
      restrictions.push(
        t("prep.restriction.minAge", { min: formatNumber(rules.minAge) }),
      );
    } else if (rules.maxAge !== undefined) {
      restrictions.push(
        t("prep.restriction.maxAge", { max: formatNumber(rules.maxAge) }),
      );
    }
    if (!rules.pregnancySafe) {
      restrictions.push(t("prep.restriction.pregnancy"));
    }
    for (const condition of rules.excludedConditions) {
      restrictions.push(
        t("prep.restriction.condition", { condition: L.condition(condition) }),
      );
    }
  }

  /**
   * A profile is only ever screened on gender and age — the two clinical facts
   * it stores. The pregnancy and excluded-condition restrictions are still in
   * `restrictions` above, where the patient reads them and acknowledges them.
   */
  const describeViolation = (violation: EligibilityViolation): string => {
    switch (violation.code) {
      case "gender":
        return rules?.genders?.[0] === "male"
          ? t("prep.violation.genderMale", { service: serviceName })
          : t("prep.violation.genderFemale", { service: serviceName });
      case "min_age":
        return t("prep.violation.minAge", {
          service: serviceName,
          name: profile.fullName,
          min: formatNumber(rules?.minAge ?? 0),
          age: formatNumber(age),
        });
      case "max_age":
        return t("prep.violation.maxAge", {
          service: serviceName,
          name: profile.fullName,
          max: formatNumber(rules?.maxAge ?? 0),
          age: formatNumber(age),
        });
      default:
        return violation.message;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t("prep.title")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("prep.subtitle", { service: serviceName })}
        </p>
      </div>

      {prep && (
        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          <h3 className="flex items-center gap-2 font-semibold">
            <FileText className="size-4 text-primary" />
            {t("prep.howToPrepare")}
          </h3>

          <ul className="mt-4 space-y-3 text-sm">
            <PrepRow
              icon={Utensils}
              label={t("prep.label.fasting")}
              value={
                prep.fastingRequired
                  ? t("prep.fastingRequired", {
                      hours: formatNumber(prep.fastingHours ?? 12),
                    })
                  : t("prep.fastingNotRequired")
              }
            />

            {prep.fastingRequired && (
              <PrepRow
                icon={Droplets}
                label={t("prep.label.water")}
                value={
                  prep.waterAllowed
                    ? t("prep.waterAllowed")
                    : t("prep.waterNotAllowed")
                }
              />
            )}

            <PrepRow
              icon={Pill}
              label={t("prep.label.medication")}
              value={
                prep.medicationRestrictions.length > 0
                  ? prep.medicationRestrictions.map((line) => localized(line))
                  : t("prep.medicationNone")
              }
            />

            <PrepRow
              icon={Clock}
              label={t("prep.label.onTheDay")}
              value={localized(prep.arrivalInstructions)}
            />

            <PrepRow
              icon={FileText}
              label={t("prep.label.bring")}
              value={
                prep.documentsRequired.length > 0
                  ? prep.documentsRequired.map((line) => localized(line))
                  : t("prep.documentsNone")
              }
            />
          </ul>
        </section>
      )}

      {restrictions.length > 0 && (
        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          <h3 className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="size-4 text-primary" />
            {t("prep.whoCanHave")}
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            {restrictions.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                  aria-hidden
                />
                {line}
              </li>
            ))}
          </ul>
        </section>
      )}

      {result.eligible ? (
        <section className="space-y-3 rounded-2xl border bg-card p-5 shadow-soft">
          <h3 className="font-semibold">{t("prep.ack.title")}</h3>
          <p className="text-sm text-muted-foreground">{t("prep.ack.subtitle")}</p>

          <div className="flex items-start gap-3 rounded-xl border bg-background p-4">
            <Checkbox
              id="ack-preparation"
              checked={value.preparationAccepted}
              onCheckedChange={(checked: boolean) =>
                onChange({ ...value, preparationAccepted: checked })
              }
              className="mt-0.5"
            />
            <Label
              htmlFor="ack-preparation"
              className="cursor-pointer text-sm font-normal leading-relaxed"
            >
              {t("prep.ack.preparation")}
            </Label>
          </div>

          <div className="flex items-start gap-3 rounded-xl border bg-background p-4">
            <Checkbox
              id="ack-eligibility"
              checked={value.eligibilityConfirmed}
              onCheckedChange={(checked: boolean) =>
                onChange({ ...value, eligibilityConfirmed: checked })
              }
              className="mt-0.5"
            />
            <Label
              htmlFor="ack-eligibility"
              className="cursor-pointer text-sm font-normal leading-relaxed"
            >
              {t("prep.ack.eligibility", {
                name: profile.fullName,
                service: serviceName,
              })}
            </Label>
          </div>
        </section>
      ) : (
        <section
          role="alert"
          className="space-y-4 rounded-2xl border border-destructive/40 bg-destructive/5 p-5 shadow-soft"
        >
          <h3 className="flex items-center gap-2 font-semibold text-destructive">
            <AlertTriangle className="size-4" />
            {t("prep.blocked.title", {
              name: profile.fullName,
              service: serviceName,
            })}
          </h3>

          <ul className="space-y-2 text-sm">
            {result.violations.map((violation, i) => (
              <li
                key={`${violation.code}-${i}`}
                className="flex items-start gap-2"
              >
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive"
                  aria-hidden
                />
                {describeViolation(violation)}
              </li>
            ))}
          </ul>

          <p className="text-sm text-muted-foreground">{t("prep.blocked.body")}</p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              className="h-10 rounded-xl px-4"
              onClick={onChangeProfile}
            >
              {t("prep.blocked.choosePatient")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl px-4"
              onClick={onChangeService}
            >
              {t("prep.blocked.chooseService")}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function PrepRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | string[];
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Array.isArray(value) ? (
          <ul className="mt-0.5 space-y-1">
            {value.map((line) => (
              <li key={line} className="text-sm">
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-0.5 text-sm">{value}</p>
        )}
      </div>
    </li>
  );
}
