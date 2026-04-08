from __future__ import annotations

from typing import Any

from .models import MockDocument

MOCK_DOCUMENTS: list[MockDocument] = [
    MockDocument(
        id="northstar-cloud-sla",
        title="Northstar Cloud SLA Renewal",
        category="Software",
        summary="Enterprise cloud renewal with uptime credits, auto-renew language, and data residency obligations.",
        content=(
            "Supplier: Northstar Cloud.\n"
            "Term: 36 months with automatic renewal unless terminated 60 days before expiry.\n"
            "Commercials: 14% uplift year over year with prepaid annual billing.\n"
            "Service levels: 99.5% uptime with service-credit-only remedy.\n"
            "Security: customer data may be processed by subcontractors in multiple regions.\n"
            "Termination: limited for convenience rights; exit assistance is billed separately.\n"
            "Indemnity: capped at 12 months of fees.\n"
        ),
        metadata={"owner": "IT Procurement", "region": "US + EU", "value": "$2.1M"},
    ),
    MockDocument(
        id="lattice-components-msa",
        title="Lattice Components MSA",
        category="Direct Materials",
        summary="Critical component supply agreement with exclusivity clause and delivery penalties.",
        content=(
            "Supplier: Lattice Components.\n"
            "Scope: custom controller boards for Q4 manufacturing launch.\n"
            "Commercials: volume commitment of 180,000 units with take-or-pay exposure.\n"
            "Delivery: supplier liability excludes indirect damages; late shipment penalties are one-sided.\n"
            "Exclusivity: buyer agrees to source 80% of category demand from supplier.\n"
            "Subcontracting: permitted with prior notice only.\n"
            "Force majeure: broad and includes raw material shortages.\n"
        ),
        metadata={"owner": "Manufacturing Sourcing", "region": "APAC", "value": "$4.8M"},
    ),
    MockDocument(
        id="helix-logistics-rfp",
        title="Helix Logistics RFP Response",
        category="Services",
        summary="Regional logistics outsourcing proposal with KPI targets, transition fees, and data sharing terms.",
        content=(
            "Vendor: Helix Logistics.\n"
            "Scope: warehousing, freight coordination, and customer return handling.\n"
            "Commercials: transition fee payable upfront and indexed pricing after year one.\n"
            "Performance: on-time SLA of 97% with cure plan before any penalty applies.\n"
            "Data: buyer provides shipment data and customer contacts for operational optimization.\n"
            "Termination: 180-day notice after initial 24-month term.\n"
            "Insurance: cyber coverage not specified.\n"
        ),
        metadata={"owner": "Operations Procurement", "region": "EMEA", "value": "$1.6M"},
    ),
]

RISK_PATTERNS: list[tuple[str, str, str, str, str]] = [
    (
        "auto-renew",
        "medium",
        "Auto-renewal detected",
        "Renewal language can lock the buyer into an elongated term without an explicit re-bid window.",
        "renewal",
    ),
    (
        "subcontract",
        "medium",
        "Subcontractor dependency",
        "Third-party processing expands compliance scope and weakens direct operational control.",
        "subcontractors",
    ),
    (
        "indemnity",
        "high",
        "Thin indemnity protection",
        "Liability coverage appears narrow relative to the likely commercial exposure in this deal.",
        "indemnity",
    ),
    (
        "exclusiv",
        "high",
        "Category concentration",
        "Exclusivity language may reduce leverage and create single-supplier dependency.",
        "exclusivity",
    ),
    (
        "take-or-pay",
        "high",
        "Volume lock-in",
        "The commitment structure creates downside if demand softens or launches slip.",
        "take-or-pay",
    ),
    (
        "penalt",
        "medium",
        "Asymmetric penalty structure",
        "Commercial remedies look unbalanced and should be normalized before signature.",
        "penalties",
    ),
    (
        "data",
        "medium",
        "Operational data handling",
        "The document references buyer data flows without enough detail on retention, residency, or access controls.",
        "data",
    ),
    (
        "termination",
        "medium",
        "Exit friction",
        "Termination or exit assistance terms appear restrictive and could delay transition to another vendor.",
        "termination",
    ),
    (
        "insurance",
        "low",
        "Coverage detail incomplete",
        "Insurance language is present but lacks enough specificity to confirm expected policy coverage.",
        "insurance",
    ),
]


def list_mock_documents() -> list[dict[str, Any]]:
    return [document.model_dump() for document in MOCK_DOCUMENTS]


def get_mock_document(template_id: str | None) -> MockDocument | None:
    if not template_id:
        return None
    return next((item for item in MOCK_DOCUMENTS if item.id == template_id), None)


def resolve_submission(
    title: str | None,
    content: str | None,
    template_id: str | None,
) -> tuple[str, str, str | None]:
    template = get_mock_document(template_id)
    resolved_title = (title or "").strip() or (template.title if template else "Uploaded Procurement Case")
    resolved_content = (content or "").strip() or (template.content if template else "")
    return resolved_title, resolved_content, template.id if template else None


def build_sources(title: str, content: str) -> list[dict[str, str]]:
    keywords = extract_keywords(content)
    lenses = [
        ("Counterparty watchlist", "Mock retrieval over supplier delivery and financial resilience signals."),
        ("Benchmark clauses", "Mock playbook comparison against standard procurement fallback language."),
        ("Operational context", "Mock search across implementation dependencies and transition complexity."),
    ]
    return [
        {
            "title": source_title,
            "detail": f"{detail} Focus area: {keywords[index % len(keywords)]}.",
            "url": f"https://example.local/source/{index + 1}",
        }
        for index, (source_title, detail) in enumerate(lenses)
    ]


def build_risk_flags(content: str) -> list[dict[str, str]]:
    lowered = content.lower()
    flags: list[dict[str, str]] = []
    for pattern, severity, title, detail, keyword in RISK_PATTERNS:
        if pattern in lowered:
            flags.append(
                {
                    "title": title,
                    "severity": severity,
                    "detail": detail,
                    "keyword": keyword,
                }
            )
    if flags:
        return flags
    return [
        {
            "title": "Commercial ambiguity",
            "severity": "medium",
            "detail": "The submission is directionally positive but still lacks explicit fallback positions for pricing and exit mechanics.",
            "keyword": "pricing",
        }
    ]


def summarize_risk_level(flags: list[dict[str, str]]) -> str:
    if any(flag["severity"] == "high" for flag in flags):
        return "high"
    if any(flag["severity"] == "medium" for flag in flags):
        return "medium"
    return "low"


def build_research_summary(title: str, content: str, sources: list[dict[str, str]]) -> str:
    themes = ", ".join(extract_keywords(content)[:3])
    return (
        f"The research pass on '{title}' surfaced concentration around {themes}. "
        f"Comparable sourcing patterns suggest the supplier package is commercially workable, but negotiation leverage depends on tightening control around the operational clauses referenced in the intake."
    )


def build_risk_summary(flags: list[dict[str, str]], risk_level: str) -> str:
    top_flags = ", ".join(flag["title"] for flag in flags[:3])
    return (
        f"Overall risk is {risk_level.upper()}. The main pressure points are {top_flags}. "
        "The current draft should not move to signature without targeted redlines and explicit business-owner signoff."
    )


def build_decision_summary(title: str, risk_level: str, flags: list[dict[str, str]]) -> str:
    if risk_level == "high":
        posture = "Proceed only with executive approval and non-negotiable redlines"
    elif risk_level == "medium":
        posture = "Proceed to negotiation with controlled concessions"
    else:
        posture = "Proceed with standard legal review"
    flag_text = ", ".join(flag["title"] for flag in flags[:2])
    return (
        f"{posture} for '{title}'. The decision package prioritizes remediation of {flag_text} before commercial alignment is treated as complete."
    )


def extract_keywords(content: str) -> list[str]:
    candidates = [
        "auto-renewal" if "renew" in content.lower() else "",
        "subcontractors" if "subcontract" in content.lower() else "",
        "exclusivity" if "exclusiv" in content.lower() else "",
        "termination" if "termination" in content.lower() else "",
        "data governance" if "data" in content.lower() else "",
        "liability caps" if "indemnity" in content.lower() else "",
        "volume commitments" if "volume" in content.lower() or "take-or-pay" in content.lower() else "",
    ]
    keywords = [candidate for candidate in candidates if candidate]
    return keywords or ["pricing discipline", "operational transition", "service resilience"]
