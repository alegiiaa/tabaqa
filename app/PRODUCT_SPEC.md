# Tabaqa — Instant Financing Decision Engine
## Complete Product and MVP Technical Specification

> Received from the founder on 2026-07-15 ("the latest message for upgrading the Tabaqa idea").
> NOTE: §24 explicitly repositions Tabaqa as a SINGLE-BANK embedded engine — this reverses the
> Jul 12 multi-lender marketplace framing. Reconcile before the freeze.

## 1. Product Overview

Tabaqa is an embedded financing decision engine that integrates into a bank's existing mobile application through APIs.

It transforms the traditional financing process from a long, document-heavy journey into an automated digital experience.

The customer selects the financing product they need, gives explicit consent to access the required data, and submits the request. In the background, Tabaqa collects, verifies, normalizes, and analyzes the customer's financial, employment, and credit information.

Tabaqa then applies:

- Regulatory affordability rules.
- The bank's internal eligibility policies.
- The bank's pricing rules.
- Product-specific financing conditions.
- Basic fraud and data-consistency checks.

Within seconds, the customer receives financing options for which they are eligible.

After selecting an option, Tabaqa generates the required disclosures, repayment schedule, financing application, and digital agreements. The customer reviews the documents and confirms electronically.

For standard cases, the credit decision is fully automated and does not require a bank employee to manually review the application.

Human review is only required when the application contains an exception, inconsistency, missing data, suspected fraud, or a condition outside the bank's automated approval policy.

Tabaqa does not replace the bank. It automates the operational work that normally happens before the financing decision.

---

## 2. Core Value Proposition

### For the Customer

Tabaqa allows a customer to:

- Apply for financing directly inside the bank's mobile application.
- Avoid manually uploading salary certificates, bank statements, or repeated forms.
- Know their financing eligibility within seconds.
- See multiple financing scenarios from the same bank.
- Understand the financing amount, monthly installment, term, fees, APR, and total repayment.
- Complete the application and electronic confirmation digitally.
- Receive a clear explanation if they are not eligible.

### For the Bank

Tabaqa allows the bank to:

- Automate customer data collection.
- Reduce incomplete applications.
- Reduce manual document verification.
- Standardize affordability calculations.
- Apply the bank's eligibility policies automatically.
- Generate financing offers instantly.
- Reduce operational processing time.
- Reduce manual underwriting for standard customers.
- Maintain a complete audit trail for every decision.
- Route only exceptional applications to human reviewers.

---

## 3. Main Product Statement

Tabaqa is an API-based automated financing decision engine that converts customer-consented data into a verified, calculated, and bank-ready financing application within seconds.

---

## 4. One-Line Pitch

From customer consent to an automated financing decision in seconds.

---

## 5. Primary Use Case

The MVP should demonstrate a customer named Ahmed applying for vehicle financing through a fictional bank mobile application.

Ahmed wants SAR 150,000 to purchase a vehicle.

The experience begins and ends inside the bank's mobile application.

Tabaqa operates in the background and should appear as the bank's embedded financing intelligence infrastructure rather than as a separate consumer application.

---

## 6. Main Customer Journey

### Step 1: Customer Login

Ahmed logs into the bank's mobile application using the normal bank authentication process.

For the MVP, authentication may be simulated using:

- A phone number.
- A customer ID.
- A password or OTP.
- A predefined demo account.

The MVP does not need to implement a real national identity provider.

### Step 2: Financing Section

Ahmed opens the "Financing" section.

The screen should show product categories such as:

- Personal Financing.
- Vehicle Financing.
- Home Financing.

For the MVP, Vehicle Financing should be fully functional. The other categories may appear as disabled or "Coming Soon."

### Step 3: Financing Request

Ahmed selects Vehicle Financing.

He enters:

- Requested amount: SAR 150,000.
- Preferred repayment term: optional.
- Desired monthly installment: optional.
- Vehicle price: optional.
- Down payment: optional.

The customer should also have the option:

"Calculate the maximum amount I can receive."

If this option is selected, the requested financing amount is not required.

### Step 4: Data Consent

Before any external data is collected, Ahmed sees a clear consent screen.

The screen should explain that the bank will access the data required to assess his financing eligibility.

The MVP consent screen should include the following sources:

- The customer's accounts inside the current bank.
- Other bank accounts through simulated Open Banking connections.
- Digital wallet data through simulated connections.
- Employment and salary information through a simulated official employment source.
- Credit obligations and credit history through a simulated credit bureau source.

The customer should be able to:

- Review the data sources.
- Read the purpose of data collection.
- Approve all required sources.
- Cancel the process.

Recommended button text:

"Allow Access and Calculate My Eligibility"

Do not use "Run" as the customer-facing button.

The system must store:

- Customer ID.
- Consent timestamp.
- Approved data sources.
- Purpose of consent.
- Consent status.
- Financing product.
- Request reference number.

### Step 5: Automated Data Collection

After consent, Tabaqa begins the data collection process.

The interface should show a short progress experience, such as:

- Verifying identity.
- Retrieving employment information.
- Connecting financial accounts.
- Analyzing income and expenses.
- Checking existing obligations.
- Applying the bank's financing policy.
- Preparing eligible offers.

This process should take approximately three to six seconds in the MVP.

The data will be mocked, but the architecture should simulate independent data connectors.

### Step 6: Data Normalization

Tabaqa receives information from different sources and converts it into one standardized customer financial profile.

The normalized profile should include:

**Personal Information**

- Customer ID.
- Full name.
- Nationality.
- Date of birth.
- Age.
- Mobile number.
- Identity verification status.

**Employment Information**

- Employment sector.
- Employment type.
- Employer.
- Job title.
- Employment start date.
- Length of service.
- Verified monthly salary.
- Salary payment frequency.
- Salary verification status.

Employment sectors may include:

- Government.
- Military.
- Private sector.
- Self-employed.

**Financial Information**

- Salary account balance.
- Other bank balances.
- Digital wallet balances.
- Average monthly inflows.
- Average monthly outflows.
- Average monthly salary.
- Additional recurring income.
- Essential monthly expenses.
- Existing monthly debt payments.
- Current financing obligations.
- Credit card obligations.
- Average available monthly cash.
- Income stability score.

**Credit Information**

- Existing credit obligations.
- Total outstanding debt.
- Monthly credit obligations.
- Payment history status.
- Delinquency indicator.
- Credit score or demo credit grade.
- Recent credit inquiries.
- Credit report retrieval timestamp.

---

## 7. Financial Intelligence Engine

The Financial Intelligence Engine analyzes the normalized financial transactions.

For the MVP, the engine should perform the following tasks:

### Income Detection

Identify:

- Monthly salary.
- Additional recurring income.
- Stable transfers received regularly.
- Irregular income that should not be fully counted.
- Total verified monthly income.

Example:

- Verified salary: SAR 18,000.
- Stable side income: SAR 2,000.
- Irregular transfers: SAR 1,500.

The bank may count:

- 100% of verified salary.
- 50% of stable side income.
- 0% of irregular transfers.

Calculated eligible income:

SAR 18,000 + SAR 1,000 = SAR 19,000.

The percentages should be configurable by the bank.

### Expense Analysis

Classify transactions into:

- Housing.
- Utilities.
- Food.
- Transportation.
- Insurance.
- Education.
- Existing financing payments.
- Credit card payments.
- Subscriptions.
- Discretionary spending.
- Other recurring commitments.

For the MVP, use predefined categorized transactions rather than building a complex machine learning classifier.

### Obligation Detection

Identify:

- Existing personal financing.
- Vehicle financing.
- Credit card monthly obligations.
- Buy-now-pay-later obligations.
- Other recurring debt payments.

### Income Stability

The system should determine whether income is:

- Stable.
- Moderately stable.
- Unstable.

For the MVP, use rule-based logic.

Example:

- Same employer for more than 12 months.
- Salary received regularly for the last six months.
- Salary variation below 10%.

Result: Stable income.

---

## 8. Affordability Engine

The Affordability Engine calculates how much additional financing the customer may be able to afford.

The exact rules must be configurable because affordability limits may differ depending on:

- Income level.
- Employment type.
- Financing product.
- Existing obligations.
- Bank policy.
- Regulatory requirements.
- Customer risk profile.

The MVP should not hardcode one universal percentage as the only rule.

### Required Calculations

**Total Eligible Monthly Income**

Eligible Income = Verified Salary + Accepted Additional Income

**Existing Monthly Obligations**

Existing Obligations = Existing Financing Payments + Credit Card Obligations + Other Debt Commitments

**Maximum Allowed Total Monthly Obligations**

Maximum Total Obligations = Eligible Income × Configured Debt Burden Limit

**Available Monthly Installment Capacity**

Available Installment Capacity = Maximum Total Obligations − Existing Monthly Obligations

**Disposable Income**

Disposable Income = Eligible Income − Essential Expenses − Existing Obligations

The bank may apply an additional disposable-income safety limit.

**Approved Maximum Installment**

Approved Maximum Installment = Minimum of:

- Available installment capacity.
- Disposable-income-based limit.
- Product maximum installment.
- Bank risk limit.

**Maximum Financing Amount**

The financing amount should be calculated using:

- Approved monthly installment.
- Financing term.
- Annual percentage rate or profit rate.
- Administrative fees.
- Product-specific calculation method.

For the MVP, use a standard amortization calculation.

Example formula:

Monthly Rate = Annual Rate / 12

Financing Amount = Monthly Payment ×
[(1 + Monthly Rate)^Number of Payments − 1] /
[Monthly Rate × (1 + Monthly Rate)^Number of Payments]

The implementation should clearly label this as a demo financing formula.

The formula must be isolated inside a service or configuration module so it can later be replaced by the bank's official calculation logic.

---

## 9. Bank Policy Engine

The Bank Policy Engine applies the bank's own financing rules.

The MVP should use a fictional bank policy configuration.

Do not use the name, logo, or claim partnership with a real bank.

Suggested fictional name:

"Demo Bank"

### Example Bank Policy Configuration

**General Eligibility**

- Minimum age: 21.
- Maximum age at financing maturity: 60.
- Minimum monthly salary: SAR 5,000.
- Minimum employment period:
  - Government: 3 months.
  - Military: 3 months.
  - Private sector: 6 months.
  - Self-employed: 12 months.
- Minimum credit grade: C.
- No active serious delinquency.
- Identity must be verified.
- Salary must be verified.
- Customer consent must be active.

**Vehicle Financing Rules**

- Minimum financing amount: SAR 20,000.
- Maximum financing amount: SAR 500,000.
- Available terms:
  - 12 months.
  - 24 months.
  - 36 months.
  - 48 months.
  - 60 months.
- Maximum vehicle age: configurable.
- Minimum down payment: optional.
- Administrative fee: configurable.
- APR or profit rate: based on customer risk grade.

**Example Pricing Rules**

- Risk Grade A: 4.5%.
- Risk Grade B: 5.5%.
- Risk Grade C: 6.5%.
- Risk Grade D: manual review.
- Risk Grade E: decline.

**Employment-Based Rules**

- Government employee: standard pricing.
- Military employee: standard pricing with a configurable retirement-age check.
- Approved private employer: standard pricing.
- Unapproved private employer: manual review.
- Self-employed customer: additional income verification required.

---

## 10. Automated Decision Engine

After all information is collected and calculated, Tabaqa produces one of three decisions.

### Decision 1: Automatically Approved

The customer is automatically approved when:

- All required data is available.
- Identity is verified.
- Employment is verified.
- Income is verified.
- Credit information is acceptable.
- No major inconsistency exists.
- No fraud indicator exists.
- The customer passes affordability rules.
- The customer passes bank policy rules.
- The requested amount is within the approved maximum amount.

The customer should immediately see eligible financing options.

### Decision 2: Automatically Declined

The customer may be automatically declined when:

- Income is below the required minimum.
- Existing obligations exceed the allowed limit.
- The customer has a serious delinquency.
- The customer fails a mandatory bank policy.
- The customer is outside the accepted age range.
- The customer has insufficient employment duration.
- The requested product is not available for the customer.

The system should show an understandable explanation.

Example:

"You are currently not eligible because your existing monthly obligations exceed the bank's approved limit."

Do not expose confidential internal risk logic.

### Decision 3: Manual Review Required

The system routes the request to manual review only when:

- Employment information conflicts with salary transactions.
- The customer's identity data is inconsistent.
- Income is highly irregular.
- A fraud indicator is detected.
- A required data source is unavailable.
- The application requires a policy exception.
- The customer falls near a policy boundary.
- The customer has a risk grade that requires manual review.

The MVP may show this result, but it does not need to build a complete employee-review workflow.

---

## 11. Financing Offer Engine

For approved customers, Tabaqa generates multiple financing scenarios from the same bank.

This is not a marketplace comparing multiple banks.

The offers are different configurations of the bank's own financing product.

### Example Offers for Ahmed

**Option 1: Lowest Monthly Installment**

- Financing amount: SAR 150,000.
- Term: 60 months.
- Monthly installment: SAR 2,950.
- APR: 6.2%.
- Administrative fee: SAR 1,500.
- Total repayment: SAR 178,500.

**Option 2: Balanced Option**

- Financing amount: SAR 150,000.
- Term: 48 months.
- Monthly installment: SAR 3,550.
- APR: 5.9%.
- Administrative fee: SAR 1,500.
- Total repayment: SAR 171,900.

**Option 3: Lowest Total Cost**

- Financing amount: SAR 150,000.
- Term: 36 months.
- Monthly installment: SAR 4,650.
- APR: 5.6%.
- Administrative fee: SAR 1,500.
- Total repayment: SAR 168,900.

The numbers above are demo values and should be calculated dynamically by the application.

### Offer Comparison Fields

Each offer must display:

- Financing amount.
- Financing term.
- Monthly installment.
- APR.
- Profit rate if applicable.
- Administrative fee.
- Total financing cost.
- Total amount payable.
- First payment date.
- Offer expiry date.
- Eligibility status.

### Recommended Offer

Tabaqa may highlight one option as "Recommended."

The recommendation should be explainable.

Example:

"Recommended because it provides a balance between monthly affordability and total financing cost."

The recommendation should not claim to be independent financial advice.

---

## 12. Document Generation

After Ahmed selects an offer, Tabaqa generates the required financing documents.

For the MVP, generate digital preview documents rather than legally binding real documents.

### Required MVP Documents

- Financing application summary.
- Product disclosure summary.
- Repayment schedule.
- Customer consent record.
- Customer financial summary.
- Affordability calculation summary.
- Selected offer summary.
- Terms and conditions.
- Electronic confirmation statement.

The documents may be displayed as HTML pages or downloadable demo PDFs.

### Repayment Schedule

The repayment schedule should show:

- Installment number.
- Payment date.
- Principal amount.
- Profit or interest amount.
- Total installment.
- Remaining balance.

For the MVP, generate the schedule programmatically.

---

## 13. Electronic Confirmation Flow

After reviewing the documents, Ahmed accepts the offer electronically.

### MVP Flow

1. Ahmed checks: "I have reviewed and accepted the financing terms."
2. Ahmed clicks: "Confirm Financing Request."
3. The system sends a simulated OTP.
4. The MVP displays a demo OTP or uses a fixed code such as: "1234"
5. Ahmed enters the code.
6. The system validates the code.
7. The request status changes to: "Automatically Approved — Documentation Completed"

The final screen should say:

"Your financing application has been approved automatically and all required documents have been completed. The request is ready for activation according to the bank's approved process."

Do not state that real funds have been transferred in the MVP.

---

## 14. Compliance Receipt

Tabaqa should generate an internal compliance and decision receipt.

This is one of the most important differentiating features.

The receipt should include:

- Application ID.
- Customer ID.
- Financing product.
- Requested amount.
- Approved amount.
- Decision result.
- Decision timestamp.
- Consent timestamp.
- Data sources used.
- Identity verification result.
- Employment verification result.
- Verified salary.
- Accepted additional income.
- Essential expenses.
- Existing obligations.
- Debt burden result.
- Disposable income result.
- Credit grade.
- Policy rules applied.
- Failed or passed rule IDs.
- Fraud indicators.
- Documents generated.
- Electronic confirmation status.
- Model or rules-engine version.
- Audit log reference.

The customer does not need to see the full internal receipt.

The bank dashboard may show a simplified version.

---

## 15. Bank Dashboard

The MVP should include a simple bank-side dashboard.

It should display financing applications processed by Tabaqa.

### Dashboard Main Table

Columns:

- Application ID.
- Customer name.
- Product.
- Requested amount.
- Approved amount.
- Decision.
- Risk grade.
- Completion percentage.
- Submission date.
- Processing time.

### Application Detail Page

The detail page should include:

**Customer Summary**

- Name.
- Age.
- Employment sector.
- Employer.
- Monthly salary.
- Employment duration.

**Financial Summary**

- Total eligible income.
- Essential expenses.
- Existing obligations.
- Available monthly installment.
- Maximum approved financing.

**Decision Summary**

- Approved.
- Declined.
- Manual review.

**Data Verification**

- Identity: Verified.
- Employment: Verified.
- Salary: Verified.
- Credit information: Retrieved.
- Open Banking data: Retrieved.
- Wallet data: Retrieved.

**Offer Selected**

- Amount.
- Term.
- Monthly installment.
- APR.
- Total repayment.

**Audit Timeline**

- Consent received.
- Data retrieved.
- Profile normalized.
- Affordability calculated.
- Bank policy applied.
- Decision generated.
- Offer selected.
- Documents generated.
- OTP confirmed.

For approved standard cases, no employee action is required.

The dashboard exists mainly for monitoring, auditability, and exception management.

---

## 16. MVP System Architecture

The MVP should use a modular architecture.

### Frontend Applications

**Customer Mobile Web Application**

Simulates the bank mobile application.

Main screens:

- Login.
- Home.
- Financing products.
- Financing request.
- Consent.
- Processing status.
- Financing offers.
- Offer details.
- Document review.
- OTP confirmation.
- Final status.

**Bank Dashboard**

A web dashboard for viewing applications and decisions.

### Backend Services

1. **Authentication Service** — demo login, customer session, role management, customer versus bank employee access.
2. **Consent Service** — create consent request, record selected data sources, store consent timestamp, check whether consent is active, link consent to financing application.
3. **Data Connector Service** — retrieve mock banking data, mock wallet data, mock employment data, mock credit data; return connector status; simulate unavailable sources.
4. **Data Normalization Service** — convert all source data into one customer profile, remove duplicate transactions, standardize date formats, standardize currency, match customer identities across sources.
5. **Financial Intelligence Service** — identify salary, detect recurring income, categorize expenses, detect recurring obligations, calculate income stability, generate financial summary.
6. **Affordability Service** — calculate eligible income, existing obligations, disposable income, available installment, maximum financing amount.
7. **Bank Policy Service** — load bank rules, evaluate customer eligibility, generate pass or fail results, produce explainable reason codes.
8. **Decision Service** — combine affordability, policy, credit, and fraud results; return approved, declined, or manual review; store decision version and timestamp.
9. **Offer Service** — generate financing scenarios, calculate monthly installments, calculate APR and total repayment, recommend one offer.
10. **Document Service** — generate disclosure documents, repayment schedule, financing summary; store document references.
11. **OTP Service** — generate demo OTP, store expiry time, validate OTP, record confirmation.
12. **Audit Service** — record every important action, maintain an immutable event timeline, produce compliance receipt.

---

## 17. Suggested MVP Technology Stack

The development team may change the stack, but the following is suitable for a fast MVP.

**Frontend**

- React or Next.js.
- Tailwind CSS.
- Responsive mobile-first design.
- Chart library only if needed.

**Backend**

Choose one:

- Node.js with Express or NestJS.
- Python with FastAPI.

FastAPI may be convenient for financial calculations and future AI integration.

**Database**

- PostgreSQL.
- Supabase may be used for faster development.
- SQLite is acceptable for a local prototype.

**Authentication**

- Supabase Auth.
- Firebase Authentication.
- Custom demo authentication.

**Document Generation**

- HTML templates.
- PDFKit.
- Puppeteer.
- ReportLab if using Python.

**Hosting**

- Vercel for frontend.
- Render, Railway, or Supabase for backend.
- Local deployment is acceptable if internet connectivity is unreliable during the presentation.

---

## 18. Suggested Database Entities

**Customer** — id, full_name, national_id_demo, mobile_number, date_of_birth, created_at.

**EmploymentProfile** — id, customer_id, employer_name, employment_sector, job_title, employment_start_date, verified_salary, verification_status.

**FinancialAccount** — id, customer_id, source_type, institution_name, account_type, current_balance, currency.

**Transaction** — id, financial_account_id, transaction_date, description, amount, transaction_type, category, recurring_flag.

**CreditProfile** — id, customer_id, credit_grade, outstanding_debt, monthly_obligations, delinquency_flag, recent_inquiries.

**Consent** — id, customer_id, financing_application_id, approved_sources, purpose, status, granted_at, expires_at.

**FinancingApplication** — id, customer_id, product_type, requested_amount, requested_term, status, created_at, completed_at.

**AffordabilityAssessment** — id, financing_application_id, eligible_income, essential_expenses, existing_obligations, available_installment, maximum_financing_amount, calculation_version.

**PolicyEvaluation** — id, financing_application_id, policy_version, passed_rules, failed_rules, result.

**FinancingOffer** — id, financing_application_id, amount, term_months, monthly_installment, annual_rate, apr, administrative_fee, total_repayment, recommended_flag, selected_flag.

**Document** — id, financing_application_id, document_type, file_url, generated_at, accepted_at.

**Decision** — id, financing_application_id, decision_type, reason_codes, generated_at, decision_engine_version.

**AuditEvent** — id, financing_application_id, event_type, event_description, metadata, created_at.

---

## 19. Suggested API Endpoints

**Authentication**

- `POST /api/auth/login`

**Customer**

- `GET /api/customers/{customerId}`

**Financing Applications**

- `POST /api/financing/applications`
- `GET /api/financing/applications/{applicationId}`

**Consent**

- `POST /api/financing/applications/{applicationId}/consent`
- `GET /api/financing/applications/{applicationId}/consent`

**Data Collection**

- `POST /api/financing/applications/{applicationId}/collect-data`
- `GET /api/financing/applications/{applicationId}/data-status`

**Assessment**

- `POST /api/financing/applications/{applicationId}/assess`
- `GET /api/financing/applications/{applicationId}/assessment`

**Decision**

- `POST /api/financing/applications/{applicationId}/decision`
- `GET /api/financing/applications/{applicationId}/decision`

**Offers**

- `GET /api/financing/applications/{applicationId}/offers`
- `POST /api/financing/applications/{applicationId}/offers/{offerId}/select`

**Documents**

- `POST /api/financing/applications/{applicationId}/documents/generate`
- `GET /api/financing/applications/{applicationId}/documents`

**OTP**

- `POST /api/financing/applications/{applicationId}/otp/send`
- `POST /api/financing/applications/{applicationId}/otp/verify`

**Dashboard**

- `GET /api/dashboard/applications`
- `GET /api/dashboard/applications/{applicationId}`

---

## 20. Example Decision Logic

The following is simplified MVP logic.

```
IF consent is not active:
    return INCOMPLETE

IF identity is not verified:
    return MANUAL_REVIEW

IF salary is not verified:
    return MANUAL_REVIEW

IF serious delinquency exists:
    return DECLINED

IF customer age is below minimum:
    return DECLINED

IF employment duration is below the required limit:
    return DECLINED

Calculate eligible income
Calculate existing monthly obligations
Calculate essential expenses
Calculate disposable income
Calculate maximum installment
Calculate maximum financing amount

IF maximum installment <= 0:
    return DECLINED

IF requested amount > maximum financing amount:
    generate alternative offers up to maximum amount

IF fraud indicator is high:
    return MANUAL_REVIEW

IF all mandatory bank policy rules pass:
    return APPROVED

ELSE:
    return DECLINED or MANUAL_REVIEW depending on rule type
```

---

## 21. Demo Customer Data

**Customer**

- Name: Ahmed Al-Qahtani.
- Age: 31.
- Employment sector: Government.
- Employer: Government Entity.
- Employment duration: 4 years.
- Verified salary: SAR 18,000.
- Additional stable income: SAR 2,000.
- Accepted additional income: SAR 1,000.
- Total eligible income: SAR 19,000.

**Monthly Financial Position**

- Essential expenses: SAR 6,000.
- Existing personal financing payment: SAR 1,800.
- Credit card obligation: SAR 500.
- Other debt payment: SAR 300.
- Total existing obligations: SAR 2,600.

**Credit Profile**

- Credit grade: B.
- Serious delinquency: No.
- Recent inquiries: 1.
- Payment history: Good.

**Request**

- Product: Vehicle Financing.
- Requested amount: SAR 150,000.
- Preferred term: Not selected.

**Expected Result**

- Identity: Verified.
- Employment: Verified.
- Salary: Verified.
- Credit profile: Acceptable.
- Data completeness: 100%.
- Decision: Automatically Approved.
- Offers generated: Three.
- Recommended offer: 48-month balanced option.

---

## 22. Required MVP Screens

**Customer Side**

1. Demo bank login.
2. Bank home screen.
3. Financing products.
4. Vehicle financing request.
5. Data consent.
6. Automated processing animation.
7. Eligibility result.
8. Financing offers.
9. Offer comparison.
10. Offer details.
11. Document review.
12. OTP confirmation.
13. Final approval status.

**Bank Side**

1. Dashboard login.
2. Applications table.
3. Application detail.
4. Financial summary.
5. Decision and rule results.
6. Consent and data-source summary.
7. Selected offer.
8. Generated documents.
9. Audit timeline.

---

## 23. MVP Scope

### Must Be Included

- Customer financing request.
- Explicit customer consent.
- Mock data collection from multiple sources.
- Unified customer financial profile.
- Income, expense, and obligation analysis.
- Affordability calculation.
- Bank-policy evaluation.
- Automatic approval, decline, and manual-review outcomes.
- Multiple offers from one fictional bank.
- Offer comparison.
- Recommended option.
- Document generation.
- OTP confirmation.
- Final application status.
- Bank monitoring dashboard.
- Audit timeline.
- Compliance receipt.

### Should Be Included if Time Allows

- Maximum eligible amount mode.
- A second customer who is declined.
- A third customer routed to manual review.
- Simulated data-source failure.
- Arabic and English interface.
- Downloadable PDF documents.
- Basic charts for income and expenses.
- Admin page for modifying bank policy parameters.

### Out of Scope for the MVP

- Real Open Banking integration.
- Real national identity integration.
- Real employment-data integration.
- Real credit bureau integration.
- Real bank core-system integration.
- Real transfer or disbursement of money.
- Real legally binding electronic signature.
- Real anti-money-laundering screening.
- Production-grade fraud detection.
- Multi-bank offer aggregation.
- Comparison between different banks.
- Real customer data.
- Real bank logos or partnership claims.

---

## 24. Important Product Positioning

Tabaqa should not be presented as a multi-bank financing marketplace.

It should be presented as:

- Embedded financing infrastructure.
- An automated credit-decision support and execution engine.
- A bank-integrated affordability and eligibility engine.
- A straight-through financing processing platform.
- An automation layer between customer data and the bank's financing product.

The main customer is the bank.

The end user is the bank's customer.

---

## 25. Important Terminology

**Use:**

- Automated credit decision.
- Instant eligibility assessment.
- Straight-through processing.
- Bank-configured policy engine.
- Customer-consented data.
- Verified financial profile.
- Financing readiness.
- Automated affordability assessment.
- Bank-ready financing application.
- Exception-based human review.
- Digital documentation.
- Compliance receipt.

**Avoid:**

- Guaranteed financing.
- Zero rejection.
- The bank's approval is only a formality.
- Tabaqa replaces the bank.
- Tabaqa accesses all customer data using only the identity number.
- Health data.
- Security or criminal data.
- Every bank gives Tabaqa its confidential underwriting formula.
- Money is always disbursed within seconds.
- Tabaqa makes decisions independently from the bank.

---

## 26. Final Customer Experience

The customer experience should feel extremely simple.

Ahmed should only need to:

1. Select the financing product.
2. Enter the requested amount.
3. Approve access to the required data.
4. Wait a few seconds.
5. Review eligible options.
6. Select an offer.
7. Review the generated documents.
8. Confirm electronically.

Everything else happens automatically in the background.

---

## 27. Final Backend Flow

```
Customer submits financing request
        ↓
Customer grants explicit data consent
        ↓
Tabaqa creates application and consent record
        ↓
Data connectors retrieve financial, employment, and credit data
        ↓
Data normalization creates a unified customer profile
        ↓
Financial Intelligence Engine analyzes income, expenses, and obligations
        ↓
Affordability Engine calculates installment and financing capacity
        ↓
Bank Policy Engine applies product and eligibility rules
        ↓
Fraud and consistency checks are performed
        ↓
Automated Decision Engine returns:
Approved / Declined / Manual Review
        ↓
For approved customers, Offer Engine generates financing options
        ↓
Customer selects an offer
        ↓
Document Engine generates disclosures and repayment schedule
        ↓
Customer confirms through OTP
        ↓
Application becomes bank-ready and fully documented
        ↓
Bank dashboard receives complete audit and compliance record
```

---

## 28. Final Description for the Presentation

Tabaqa is an API-based automated financing engine embedded directly within a bank's mobile application.

When a customer requests financing and gives consent, Tabaqa securely retrieves the required financial, employment, and credit data through integrated sources. It converts this data into a unified and verified financial profile, analyzes the customer's income, expenses, obligations, and repayment capacity, and then applies the bank's configured eligibility, affordability, risk, and pricing policies.

For standard applications, Tabaqa produces an automated financing decision within seconds and generates eligible financing options showing the amount, monthly installment, term, APR, fees, and total repayment.

After the customer selects an option, Tabaqa automatically prepares the required disclosures, financing documents, repayment schedule, and electronic confirmation flow.

As a result, the customer completes the financing journey digitally without manually uploading repeated documents, while the bank receives a complete, verified, explainable, and auditable financing application.

Human review is only required for exceptional cases involving missing data, inconsistencies, suspected fraud, or policy exceptions.

Tabaqa turns financing from a manual process into a straight-through digital experience.

---

## 29. Final Instruction to the AI Developer

Build a polished, responsive MVP that prioritizes the visible end-to-end customer journey.

The application must clearly demonstrate that Tabaqa operates invisibly inside the bank's application.

Use mocked but realistic Saudi financial data.

All calculations, rules, and data-source responses must be configurable and separated from the user interface.

The demo should prioritize:

- Speed.
- Clarity.
- Trust.
- Explainability.
- Automation.
- Professional banking design.
- Consistency between the customer application and bank dashboard.

The most important demonstration is the transformation of a simple financing request into a complete automated decision, personalized financing offers, generated documentation, electronic confirmation, and an auditable bank-ready application.
