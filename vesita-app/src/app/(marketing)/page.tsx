"use client";

import Link from "next/link";
import {
  BadgeCheck,
  CalendarCheck,
  CreditCard,
  Quote,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Wallet,
} from "lucide-react";

import { ProviderRail } from "@/components/marketing/provider-rail";
import { SectionHeading } from "@/components/marketing/section-heading";
import { SpecialtiesGrid } from "@/components/marketing/specialties-grid";
import { Reveal, RevealItem } from "@/components/shared/motion";
import { RatingStars } from "@/components/shared/rating";
import { SearchBar } from "@/components/shared/search-bar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SITE } from "@/lib/site";

const TRUST_STATS = [
  { value: "12,400+", label: "Verified providers" },
  { value: "1.8M", label: "Bookings completed" },
  { value: "27", label: "Governorates covered" },
  { value: "4.8/5", label: "Average patient rating" },
];

const HOW_IT_WORKS = [
  {
    icon: Search,
    title: "Search",
    description:
      "Filter by specialty, area, price and rating — or just type a symptom, a test or a scan name.",
  },
  {
    icon: CalendarCheck,
    title: "Pick a slot",
    description:
      "See real availability for the next 30 days and choose the time that fits your day.",
  },
  {
    icon: BadgeCheck,
    title: "Confirm instantly",
    description:
      "Book in under a minute. You get an SMS and WhatsApp confirmation with the clinic address.",
  },
  {
    icon: Wallet,
    title: "Visit & earn cashback",
    description:
      "Pay cash at the clinic or online, then collect cashback in your Vesita wallet after the visit.",
  },
];

const VALUE_PROPS = [
  {
    icon: ShieldCheck,
    title: "Every provider is verified",
    description:
      "We check licences, syndicate registration and accreditation before a profile goes live.",
  },
  {
    icon: CreditCard,
    title: "Transparent pricing",
    description:
      "The consultation fee, test price or scan price you see is the price you pay. No surprises.",
  },
  {
    icon: Sparkles,
    title: "Real reviews only",
    description:
      "Reviews can only be left by patients who actually completed a booking through Vesita.",
  },
];

const TESTIMONIALS = [
  {
    name: "Mariam Abdelrahman",
    location: "Nasr City, Cairo",
    rating: 5,
    quote:
      "I booked a paediatrician for my daughter at 11pm and had a 9am slot the next morning. The fee on the site was exactly what we paid at the clinic — no extra pounds at the reception desk.",
  },
  {
    name: "Ahmed El-Sayed",
    location: "Smouha, Alexandria",
    rating: 5,
    quote:
      "The lab sent someone to draw blood at my flat and the results were on WhatsApp the next afternoon. I used to lose half a day queuing for a CBC.",
  },
  {
    name: "Nourhan Farouk",
    location: "Sheikh Zayed, Giza",
    rating: 4,
    quote:
      "I compared five MRI centers in Giza in about two minutes. The reviews were honest about waiting times, which is exactly what I needed to pick one.",
  },
  {
    name: "Karim Mostafa",
    location: "Mansoura, Dakahlia",
    rating: 5,
    quote:
      "My father needed a cardiologist urgently. The 'available today' filter found one 10 minutes from the house and we were seen that same evening.",
  },
  {
    name: "Salma Hegazy",
    location: "Maadi, Cairo",
    rating: 5,
    quote:
      "The cashback is small but it adds up. After three visits I had enough in the wallet to cover most of a follow-up consultation.",
  },
  {
    name: "Youssef Ibrahim",
    location: "Port Said",
    rating: 4,
    quote:
      "I live outside Cairo and always assumed these platforms ignore us. Vesita had eleven verified doctors in my own city, with prices listed.",
  },
];

const FAQS = [
  {
    q: "Is booking through Vesita free?",
    a: "Yes. Booking a doctor, lab test or scan through Vesita costs you nothing extra — you pay the provider exactly the price shown on their profile. We earn a commission from the provider, never from you.",
  },
  {
    q: "How do I know a doctor or center is genuine?",
    a: "Every provider on Vesita is verified before their profile is published. For doctors we check Medical Syndicate registration and their specialty degree; for labs and radiology centers we check Ministry of Health licensing and any accreditation they claim, such as ISO or CAP.",
  },
  {
    q: "Can I cancel or reschedule a booking?",
    a: "You can cancel or move a booking free of charge from your dashboard up to 4 hours before the appointment. If you paid online, the refund is returned to your original payment method or your Vesita wallet, whichever you choose.",
  },
  {
    q: "How do I pay?",
    a: "Most patients pay cash at the clinic. You can also pay online with a credit or debit card, Vodafone Cash, or InstaPay — and paying online is what makes you eligible for cashback on the visit.",
  },
  {
    q: "What is cashback and how do I use it?",
    a: "Selected doctors, labs and radiology centers run cashback campaigns that return a percentage of the amount you paid as Vesita wallet credit, usually within 24 hours of the completed visit. Wallet credit can be applied to any future booking on the platform.",
  },
  {
    q: "Do labs really collect samples from my home?",
    a: "Many do. Labs that offer it show a 'Home sample collection' badge on their profile, and you pick the home-visit option while booking. A trained phlebotomist comes to your address in the time window you choose, and results arrive digitally.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden bg-brand-gradient">
        <div className="absolute inset-0 bg-grid-pattern opacity-20" aria-hidden />

        <div className="relative mx-auto w-full max-w-7xl px-4 pt-16 pb-20 sm:px-6 sm:pt-20 lg:px-8 lg:pt-24">
          <Reveal className="mx-auto max-w-3xl text-center">
            <RevealItem>
              <Badge className="mb-5 gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-white backdrop-blur">
                <Sparkles className="size-3.5" />
                Trusted by patients in 27 governorates
              </Badge>
            </RevealItem>

            <RevealItem>
              <h1 className="text-3xl font-bold tracking-tight text-balance text-white sm:text-4xl lg:text-5xl">
                Find the right doctor, lab or scan — and book it in a minute.
              </h1>
            </RevealItem>

            <RevealItem>
              <p className="mx-auto mt-4 max-w-2xl text-base text-pretty text-white/85 sm:text-lg">
                {SITE.description}
              </p>
            </RevealItem>
          </Reveal>

          <Reveal className="mx-auto mt-9 max-w-5xl" delay={0.1}>
            <RevealItem>
              <SearchBar variant="hero" />
            </RevealItem>
          </Reveal>

          <Reveal className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-6 lg:grid-cols-4">
            {TRUST_STATS.map((stat) => (
              <RevealItem key={stat.label} className="text-center">
                <p className="text-2xl font-bold text-white tabular-nums sm:text-3xl">
                  {stat.value}
                </p>
                <p className="mt-1 text-xs text-white/75 sm:text-sm">{stat.label}</p>
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* --------------------------------------------------------- Value props */}
      <section className="border-b bg-card py-10">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="grid gap-6 md:grid-cols-3">
            {VALUE_PROPS.map(({ icon: Icon, title, description }) => (
              <RevealItem key={title} className="flex items-start gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------------- Specialties */}
      <SpecialtiesGrid />

      {/* ------------------------------------------------------ Featured rails */}
      <div className="bg-muted/40">
        <ProviderRail
          type="doctor"
          eyebrow="Top rated"
          title="Featured doctors"
          description="Highly rated consultants and specialists with open slots this week."
        />
      </div>

      <ProviderRail
        type="lab"
        eyebrow="Analysis"
        title="Featured medical labs"
        description="Accredited laboratories with transparent test prices and home sample collection."
      />

      <div className="bg-muted/40">
        <ProviderRail
          type="radiology"
          eyebrow="Imaging"
          title="Featured radiology centers"
          description="X-ray, ultrasound, CT and MRI centers with modern equipment and fast reporting."
        />
      </div>

      {/* ------------------------------------------------------- How it works */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            align="center"
            eyebrow="How it works"
            title="Four steps from symptom to appointment"
            description="No phone calls, no waiting on hold, no guessing what it will cost."
          />

          <Reveal className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map(({ icon: Icon, title, description }, index) => (
              <RevealItem key={title}>
                <Card className="relative h-full border-border/60">
                  <CardContent className="space-y-3 pt-2">
                    <span className="absolute top-4 right-5 text-4xl font-bold text-muted-foreground/15 tabular-nums">
                      {index + 1}
                    </span>
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="size-6" />
                    </span>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </CardContent>
                </Card>
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* -------------------------------------------------------- Testimonials */}
      <section className="bg-muted/40 py-14 sm:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            align="center"
            eyebrow="Patient stories"
            title="What patients across Egypt say"
            description="Every review on Vesita comes from a patient who completed a real booking."
          />

          <Reveal className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {TESTIMONIALS.map((testimonial) => (
              <RevealItem key={testimonial.name}>
                <Card className="h-full border-border/60">
                  <CardContent className="flex h-full flex-col gap-4">
                    <Quote className="size-6 text-primary/30" aria-hidden />
                    <p className="flex-1 text-sm leading-relaxed text-foreground/90">
                      “{testimonial.quote}”
                    </p>
                    <div className="border-t pt-4">
                      <RatingStars value={testimonial.rating} size="sm" precise={false} />
                      <p className="mt-2 text-sm font-semibold">{testimonial.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {testimonial.location}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </RevealItem>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------------------- FAQ */}
      <section className="py-14 sm:py-20">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            align="center"
            eyebrow="FAQ"
            title="Questions patients ask us"
            description="Still stuck? Call us on 16123, any day from 9am to 11pm."
          />

          <Reveal>
            <RevealItem>
              <div className="rounded-2xl border bg-card px-5 shadow-soft">
                <Accordion>
                  {FAQS.map((faq) => (
                    <AccordionItem key={faq.q} value={faq.q}>
                      <AccordionTrigger className="py-4 text-base font-medium">
                        {faq.q}
                      </AccordionTrigger>
                      <AccordionContent className="pr-8 pb-4 text-sm leading-relaxed text-muted-foreground">
                        {faq.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </RevealItem>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------------------------------------- Final CTA */}
      <section className="pb-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <RevealItem>
              <div className="relative overflow-hidden rounded-3xl bg-brand-gradient px-6 py-14 text-center shadow-lift sm:px-12">
                <div
                  className="absolute inset-0 bg-grid-pattern opacity-20"
                  aria-hidden
                />
                <div className="relative mx-auto max-w-2xl">
                  <Star className="mx-auto mb-4 size-8 fill-white/90 text-white/90" />
                  <h2 className="text-2xl font-bold text-balance text-white sm:text-3xl">
                    Your next appointment is a minute away
                  </h2>
                  <p className="mt-3 text-pretty text-white/85">
                    Search verified doctors, labs and radiology centers near you — see
                    real prices and real availability before you commit.
                  </p>
                  <div className="mt-7 flex flex-wrap justify-center gap-3">
                    <Button
                      render={<Link href="/search?type=doctor" />}
                      className="h-11 rounded-xl bg-white px-6 text-primary hover:bg-white/90"
                    >
                      <Stethoscope className="size-4" />
                      Find a doctor
                    </Button>
                    <Button
                      render={<Link href="/search?type=lab" />}
                      variant="outline"
                      className="h-11 rounded-xl border-white/40 bg-white/10 px-6 text-white backdrop-blur hover:bg-white/20 hover:text-white"
                    >
                      <Search className="size-4" />
                      Book a test or scan
                    </Button>
                  </div>
                </div>
              </div>
            </RevealItem>
          </Reveal>
        </div>
      </section>
    </>
  );
}
