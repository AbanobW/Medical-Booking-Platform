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

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { describeEligibility, evaluateEligibility } from "@/lib/eligibility";
import type {
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

/**
 * Step 3 — preparation & eligibility (§3).
 *
 * Where a service carries preparation instructions or eligibility rules, this
 * step is mandatory and blocking: an ineligible profile can never continue, and
 * an eligible one only continues after an explicit, two-part acknowledgement.
 * This is what stops a patient arriving un-fasted, or booking a scan they
 * cannot have.
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
  const prep = preparationOf(service);
  const restrictions = describeEligibility(service);
  const result = evaluateEligibility(service, profile);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Preparation &amp; eligibility</h2>
        <p className="text-sm text-muted-foreground">
          {service.name} carries requirements a normal visit does not. Please read
          them before you book — they exist so the visit is not wasted.
        </p>
      </div>

      {prep && (
        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          <h3 className="flex items-center gap-2 font-semibold">
            <FileText className="size-4 text-primary" />
            How to prepare
          </h3>

          <ul className="mt-4 space-y-3 text-sm">
            <PrepRow
              icon={Utensils}
              label="Fasting"
              value={
                prep.fastingRequired
                  ? `Fast for ${prep.fastingHours ?? 12} hours before the appointment.`
                  : "No fasting is needed for this service."
              }
            />

            {prep.fastingRequired && (
              <PrepRow
                icon={Droplets}
                label="Water"
                value={
                  prep.waterAllowed
                    ? "Plain water is allowed — and encouraged — during the fast."
                    : "Do not drink anything, including water, during the fast."
                }
              />
            )}

            <PrepRow
              icon={Pill}
              label="Medication"
              value={
                prep.medicationRestrictions.length > 0
                  ? prep.medicationRestrictions
                  : "No medication changes are required."
              }
            />

            <PrepRow
              icon={Clock}
              label="On the day"
              value={prep.arrivalInstructions}
            />

            <PrepRow
              icon={FileText}
              label="Bring with you"
              value={
                prep.documentsRequired.length > 0
                  ? prep.documentsRequired
                  : "Nothing in particular."
              }
            />
          </ul>
        </section>
      )}

      {restrictions.length > 0 && (
        <section className="rounded-2xl border bg-card p-5 shadow-soft">
          <h3 className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="size-4 text-primary" />
            Who can have this service
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
          <h3 className="font-semibold">Your acknowledgement</h3>
          <p className="text-sm text-muted-foreground">
            Both boxes are required before this booking can be taken.
          </p>

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
              I have read and will follow the preparation instructions.
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
              I confirm {profile.fullName} meets the eligibility requirements for{" "}
              {service.name}.
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
            {profile.fullName} cannot have {service.name}
          </h3>

          <ul className="space-y-2 text-sm">
            {result.violations.map((violation) => (
              <li key={violation.code} className="flex items-start gap-2">
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive"
                  aria-hidden
                />
                {violation.message}
              </li>
            ))}
          </ul>

          <p className="text-sm text-muted-foreground">
            This booking cannot go ahead. Choose a different patient, or a
            different service.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              className="h-10 rounded-xl px-4"
              onClick={onChangeProfile}
            >
              Choose a different patient
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl px-4"
              onClick={onChangeService}
            >
              Choose a different service
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
