# API Endpoints Reference

## Base URL

Configured via `DARWIN_BASE_URL` env var (default: `https://ssl2.perquisite.net/RewardCentre`).

All paths below are relative to the base URL.

## Authentication

- SSO via Microsoft launcher URL
- Session maintained via cookies: `.ASPXAUTH`, `__AntiForgeryCookie`, `ASP.NET_SessionId`, `RewardCentre-MemberData`
- CSRF: `__RequestVerificationToken` from hidden `<input>` element in page DOM
- All requests need: `X-Requested-With: XMLHttpRequest` header

## Endpoints

### GET Api/Member/GetMemberDetails

Returns member info and feature flags.

Key fields:
- `enableMatisseSpendingAccount` — must be `true` for claims
- `firstName`, `lastName`, `username`
- `memberID`, `memberUID`

### GET Api/SpendingAccount/Load

Returns the full SpendingAccount configuration.

Response structure:
```json
{
  "benefitYears": [
    {
      "id": "uuid",
      "name": "Benefit_Year_2026",
      "canMakeClaim": true,
      "claimants": [
        {
          "id": "dependantID or null for self",
          "firstName": "...",
          "lastName": "...",
          "claimTypes": [
            {
              "id": "claimTypeID",
              "name": "MSA - Medical Claim - (EE+SP)",
              "claimNotAllowed": false,
              "isTextField1Mandatory": true,
              "isTextField2Mandatory": true,
              "textField1Title": "Clinic/Provider Name",
              "textField2Title": "Flowover to FSA (Yes/No)?",
              "isReceiptNumberMandatory": true,
              "allowForeignCurrency": false,
              "subTypes": []
            }
          ]
        }
      ]
    }
  ],
  "foreignCurrencies": []
}
```

### POST Api/SpendingAccount/UploadReceiptFile

Upload a receipt file. **Only accepts PDF**.

Request: `multipart/form-data`
- `file` — the File object
- `fileName` — file name string
- `fileID` — pre-generated UUID
- `claimID` — pre-generated UUID (same as claim id)
- `isResubmittedFile` — "false"

Response:
```json
{ "fileID": "uuid-returned-by-server" }
```

### POST Api/SpendingAccount/ValidateClaims

Validate claims before submission.

Request body: JSON array of claim objects.

Response on success: `200` with array of validation results.

Response on error: `400` with:
```json
[{
  "errors": [
    { "property": "ReceiptDate", "message": "FutureDateNotAllowed" }
  ],
  "warnings": []
}]
```

### POST Api/SpendingAccount/UpdateClaims

Submit claims for real.

Request body: same JSON array as ValidateClaims.

Response on success: `200` with:
```json
[{
  "referenceNumber": "62E777CB",
  "statusChanged": true,
  "submitDate": "2026-04-28T07:40:02Z"
}]
```

## Claim Payload Structure

```json
{
  "id": "uuid (generated)",
  "status": 1,
  "isNewClaim": true,
  "benefitPeriodID": "uuid",
  "benefitPeriodName": "Benefit_Year_2026",
  "dependantID": "uuid or null (self)",
  "claimTypeID": "uuid",
  "claimantFirstName": "FirstName",
  "claimantLastName": "LastName",
  "claimSubType1ID": "",
  "claimSubType2ID": "",
  "claimSubType3ID": "",
  "textField1": "Clinic/Provider Name",
  "textField2": "No",
  "dateField1": "",
  "dateField2": "",
  "receiptDate": "2026-01-08T00:00:00.000Z",
  "formattingBrandID": "",
  "fxReceiptAmount": null,
  "receiptAmount": 260,
  "fxRate": null,
  "claimedAmount": 260,
  "receiptNumber": "177C-00022656",
  "isFlowExcessAmount": null,
  "receiptFiles": [{
    "fileID": "uuid (from upload)",
    "fileName": "receipt.pdf",
    "fileSize": 27098,
    "rawFile": {},
    "isReceiptAttachment": false
  }],
  "isCaptureConsentAndAgreementChecked": null
}
```

## Error Codes

| Error Message | Property | Meaning |
|--------------|----------|---------|
| `FutureDateNotAllowed` | ReceiptDate | Date is in the future |
| `Required` | TextField2 | Mandatory field not populated |
| `Update_ClaimedAmountExceedsAvailableBalance` | ClaimedAmount | Insufficient account balance |
| `SpendingAccountClaimFile_FileTypeErrorMessage` | FileType | Upload: wrong file format or FormData fields |
| `ProxyReadOnly_Error` | - | Session/permission issue |
