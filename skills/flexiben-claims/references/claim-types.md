# Claim Types Reference

All claim types for Benefit_Year_2026 with field requirements.

## Allowed Claim Types (claimNotAllowed: false)

| Name | ID | textField1 | textField2 | textField2Title | receiptNum |
|------|----|-----------:|----------:|-----------------|-----------:|
| HSA - Health Screening Expenses | e1978de8... | Required | Required | Flowover to FSA (Yes/No)? | Required |
| MSA - Medical Claim - (EE+SP) | bf5a1646... | Required | Required | Flowover to FSA (Yes/No)? | Required |
| MSA - Dental Claim - (EE+SP) | 1a95796f... | Required | Required | Flowover to FSA (Yes/No)? | Required |
| MSA - Maternity | 19c21c42... | Required | Optional | - | Optional |
| MSA - Traditional Chinese Medicine - (EE+SP) | 4db415e2... | Required | Required | Flowover to FSA (Yes/No)? | Required |
| MSA - Alternative Medicine - (EE+SP) | 9d709a86... | Required | Required | Flowover to FSA (Yes/No)? | Required |
| MSA - Physiotherapy/Developmental Therapy and Others - (EE+SP) | 72b154c6... | Required | Optional | - | Required |
| MSA - Vision Expenses - (EE+SP) | 363e52ea... | Required | Required | Flowover to FSA (Yes/No)? | Required |
| FSA - Dental Expenses | 5d351e1d... | Required | Optional | - | Required |
| FSA - Medical Appliances | b13b0a16... | Required | Optional | - | Required |
| FSA - Health Screening Expenses | fdfe7513... | Required | Optional | - | Required |
| FSA - Maternity Expenses | 6bbce5d4... | Required | Optional | - | Required |
| FSA - Medical Expenses (medically required) | 0e98ff20... | Required | Optional | - | Required |
| FSA - Medical Expenses (Not medically necessary) | 660d724c... | Required | Optional | - | Required |
| FSA - Alternative Medicine | 48ad4777... | Required | Optional | - | Required |
| FSA - Traditional Chinese Medicine | eafac581... | Required | Optional | - | Required |
| FSA - Purchase of Exercise & Fitness/Health equipment | bf2102ca... | Required | Optional | - | Required |
| FSA - Purchase of Musical Instrument | 9e472d26... | Required | Optional | - | Required |
| FSA - Recreation, Sports & Fitness Club Entrance & Subscription Fees | 549e40e1... | Required | Optional | - | Required |
| FSA - Vision Care / Optical Expenses | 180fc782... | Required | Optional | - | Required |
| FSA - Domestic Help Levy | 6bc3dbcb... | Required | Optional | - | Required |
| FSA - Eldercare Expenses of Parents | 18df34d9... | Required | Required | Clinic/Provider Name | Required |
| FSA - Health Screening Expenses of Parents | 04a1b0b5... | Required | Required | Clinic/Provider Name | Required |
| FSA - Medical Expenses of Parents | ddfd5e8b... | Required | Required | Clinic/Provider Name | Required |
| FSA - Personal Life & Medical Insurance Premiums | f773cb9c... | Required | Optional | - | Required |
| FSA - Vacation Expenses & Travel Insurance | ed3aa9b2... | Required | Optional | Enter Parent Name (if applicab | Required |
| FSA - Vacation Expenses (Accomodation and Transport) | 68172c96... | Required | Optional | - | Required |
| FSA - Credit Card Subscriptions | 79c10114... | Required | Optional | - | Required |
| FSA - Extramural Courses | a2508c60... | Required | Optional | - | Required |
| FSA - Internet / Handphone Subscription Fees & Bills | 84d4f048... | Required | Optional | - | Required |
| FSA - Personal Development / Education Expenses | 52b2d703... | Required | Optional | - | Required |
| FSA - Professional Organisation Subscriptions / Publications / Magazines | dde9f9f5... | Required | Optional | - | Required |
| FSA - Purchase of Equipment For Home Office Concept | 3cd517f5... | Required | Optional | - | Required |
| FSA - Veterinary Medical Fees | eaba045c... | Required | Optional | - | Required |
| Bereavement Wreath | deb68fa7... | Required | Optional | - | Required |
| Flower Basket due to Hospitalization | 6579f755... | Required | Optional | - | Required |
| Internet Subscription Fees & Bills (Broadband account) | 8f9ade47... | Required | Optional | - | Required |
| Fitness Club/Gym Subscription Fees & Bills (Gym Subsidy Account) | 79c9af7c... | Required | Optional | - | Required |

## Full Claim Type Details

### HSA - Health Screening Expenses
- **ID**: `e1978de8-06d4-4348-ac77-86e38c9040b7`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: Flowover to FSA (Yes/No)? (mandatory: true)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### MSA - Medical Claim - (EE+SP)
- **ID**: `bf5a1646-451d-4bcc-b12d-d3a103c8ffdc`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: Flowover to FSA (Yes/No)? (mandatory: true)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### MSA - Dental Claim - (EE+SP)
- **ID**: `1a95796f-5dc8-4517-80f7-23cd7b9b8700`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: Flowover to FSA (Yes/No)? (mandatory: true)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### MSA - Maternity
- **ID**: `19c21c42-17ec-4485-bf89-007cf4a500fd`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=false
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### MSA - Traditional Chinese Medicine - (EE+SP)
- **ID**: `4db415e2-4fe8-46e7-a863-a00702d40ca6`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: Flowover to FSA (Yes/No)? (mandatory: true)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### MSA - Alternative Medicine - (EE+SP)
- **ID**: `9d709a86-f6c7-4d65-a137-b7068f3b3adf`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: Flowover to FSA (Yes/No)? (mandatory: true)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### MSA - Physiotherapy/Developmental Therapy and Others - (EE+SP)
- **ID**: `72b154c6-cea2-4abf-9eea-1f740c75f2fd`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### MSA - Vision Expenses - (EE+SP)
- **ID**: `363e52ea-1c07-4c0c-a295-dab588aa2bee`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: Flowover to FSA (Yes/No)? (mandatory: true)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Dental Expenses
- **ID**: `5d351e1d-431f-4f76-9720-8544a95c1ba5`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Medical Appliances
- **ID**: `b13b0a16-bfb9-4363-919d-a9b2c9d08256`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Health Screening Expenses
- **ID**: `fdfe7513-81d0-4253-8d56-1e3dc445b2d9`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Maternity Expenses
- **ID**: `6bbce5d4-a60c-4cf3-b705-d73afec48177`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Medical Expenses (medically required)
- **ID**: `0e98ff20-ff19-4624-b6fe-b7898e01c2a9`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Medical Expenses (Not medically necessary)
- **ID**: `660d724c-6ca5-4ccf-b009-d7bae8f3f374`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Alternative Medicine
- **ID**: `48ad4777-a6c5-4e3b-b1d0-516acdbc5ad4`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Traditional Chinese Medicine
- **ID**: `eafac581-5bd5-4bbe-9d0f-c98d019f47cb`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Purchase of Exercise & Fitness/Health equipment
- **ID**: `bf2102ca-e0f9-40a6-a6d5-e0be82e35889`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Purchase of Musical Instrument
- **ID**: `9e472d26-d89f-4670-bd0e-5cfa641dca12`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Recreation, Sports & Fitness Club Entrance & Subscription Fees
- **ID**: `549e40e1-cef6-4fff-a3bc-78351be6a831`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Vision Care / Optical Expenses
- **ID**: `180fc782-f0b4-4ddc-b615-cf5d75d7b913`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Domestic Help Levy
- **ID**: `6bc3dbcb-a495-44c3-8096-9b66704d41e2`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Eldercare Expenses of Parents
- **ID**: `18df34d9-6531-4ac3-91c7-1d7d7754a19b`
- **textField1Title**: Enter Parent Name (mandatory: true)
- **textField2Title**: Clinic/Provider Name (mandatory: true)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Health Screening Expenses of Parents
- **ID**: `04a1b0b5-d464-41a0-af80-5546f46986c0`
- **textField1Title**: Enter Parent Name (mandatory: true)
- **textField2Title**: Clinic/Provider Name (mandatory: true)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Medical Expenses of Parents
- **ID**: `ddfd5e8b-f608-441b-8402-cc1d5c384496`
- **textField1Title**: Enter Parent Name (mandatory: true)
- **textField2Title**: Clinic/Provider Name (mandatory: true)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Personal Life & Medical Insurance Premiums
- **ID**: `f773cb9c-2c5f-4fcc-8826-dac04888fc21`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Vacation Expenses & Travel Insurance
- **ID**: `ed3aa9b2-e9ba-4e79-84aa-8938ac9ab417`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: Enter Parent Name (if applicable) (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Vacation Expenses (Accomodation and Transport)
- **ID**: `68172c96-357a-4b92-8a16-86df119af117`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Credit Card Subscriptions
- **ID**: `79c10114-4d51-4372-aab4-0bea3905a1da`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Extramural Courses
- **ID**: `a2508c60-ebe7-458d-b8cc-a8bb9be334b5`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Internet / Handphone Subscription Fees & Bills
- **ID**: `84d4f048-f705-43b5-aac9-5400b5f93765`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Personal Development / Education Expenses
- **ID**: `52b2d703-9b5b-4e6f-a8a4-d30068316211`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Professional Organisation Subscriptions / Publications / Magazines
- **ID**: `dde9f9f5-1493-426b-9a31-b73eb77262f6`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Purchase of Equipment For Home Office Concept
- **ID**: `3cd517f5-5c19-481b-909b-d401adfc0024`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### FSA - Veterinary Medical Fees
- **ID**: `eaba045c-c6a7-4ef0-860c-9e49e74232b3`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### Bereavement Wreath
- **ID**: `deb68fa7-12ec-4bc5-a6c5-bc4e284c3c90`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### Flower Basket due to Hospitalization
- **ID**: `6579f755-3f29-4807-905c-5f21c2465160`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### Internet Subscription Fees & Bills (Broadband account)
- **ID**: `8f9ade47-7c92-4e6d-87fe-7c31228bbcf5`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

### Fitness Club/Gym Subscription Fees & Bills (Gym Subsidy Account)
- **ID**: `79c9af7c-edc8-42a8-ae09-b7baf54c9637`
- **textField1Title**: Clinic/Provider Name (mandatory: true)
- **textField2Title**: N/A (mandatory: false)
- **receiptNumber**: mandatory=true
- **allowForeignCurrency**: false
- **allowReceiptUpload**: 1

## Claimants

- **Jianglei Han** — self (dependantID: null)
- **Suling Nie** — dependantID: `58f294fc-ec59-4f4e-8e95-cfee95147f7f`
- **Rosey Ruoxi Han** — dependantID: `41b956c0-aba6-418d-a83d-836e48a311e3`

## Benefit Periods

- **Benefit Year 2022** (`ad5df346-0cde-4e69-8277-f96690849162`) — canMakeClaim: false
- **Benefit_Year_2023** (`be700308-15ef-4f39-bc7f-9760a8926270`) — canMakeClaim: false
- **Benefit_Year_2024** (`6235b146-8e4e-494e-8493-7cd987395f42`) — canMakeClaim: false
- **Benefit_Year_2025** (`a346fba5-ec6c-4540-92c5-a07e34f9d822`) — canMakeClaim: false
- **Benefit_Year_2026** (`75fbec5b-9e5d-4303-a9a4-cb388e732945`) — canMakeClaim: true
