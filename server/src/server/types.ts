export interface Face {
    box?: number[]
    quality: number
    template: string
    classifiers?: { [k: string]: number }
}

export interface Rect {
    x: number,
    y: number,
    width: number,
    height: number
}

type ClassifierArray = (string | number)[]

export interface FaceDetectionRequest {
    user: string
    image: string
    wait: WaitOptions
    parameters?: {
        classifiers?: ClassifierArray[]
        detector_version?: number
    }
}

export interface FaceDetectionResponse {
    faces: Face[]
    status: string
}

export interface DetectedFace {
    jpeg: string
    faceTemplate: string
}

export interface DetectFaceResponse extends DetectedFace {
    authenticityScores?: {[k: string]: number}
}

export interface CompareFacesRequest {
    target: string
    faces: string[]
}

export interface CompareFacesResponse {
    score: number,
    token?: string
}

export interface Classifier {
    prefix: string
    threshold: number
}

export interface IDCardDate {
    day: number
    month: number
    year: number
    originalString: string
}

export interface IDCardImage {
    rawImage: ImageData
    encodedImage: Uint8Array
}

export interface IDCaptureResponse {
    face?: DetectedFace
    result: IDCaptureResult
}

export interface IDCaptureResult {
    address?: string
    firstName?: string
    lastName?: string
    fullName?: string
    documentNumber?: string
    barcode?: {
        address?: string,
        addressDetailedInfo?: {
            city?: string,
            jurisdiction?: string,
            postalCode?: string,
            street?: string
        },
        barcodeData: {
            barcodeFormat: number,
            rawBytes: Uint8Array,
            stringData: string,
            uncertain: boolean
        },
        dateOfBirth: IDCardDate,
        dateOfExpiry: IDCardDate,
        dateOfIssue: IDCardDate,
        documentNumber: string,
        driverLicenseDetailedInfo?: {
            conditions: string,
            endorsements: string,
            restrictions: string,
            vehicleClass: string,
        },
        firstName: string,
        fullName: string,
        lastName: string,
        middleName?: string,
        sex: string
    }
    classInfo?: {
        country: number,
        countryName: string,
        documentType: number,
        isoAlpha2CountryCode: string,
        isoAlpha3CountryCode: string,
        isoNumericCountryCode: string,
        region: number
    }
    dataMatch?: number
    dateOfBirth?: IDCardDate
    dateOfExpiry?: IDCardDate
    dateOfIssue?: IDCardDate
    driverLicenseDetailedInfo?: {
        conditions: string,
        endorsements: string,
        restrictions: string,
        vehicleClass: string
    }
    frontViz?: {
        address?: string,
        dateOfBirth?: IDCardDate,
        dateOfExpiry?: IDCardDate,
        dateOfIssue?: IDCardDate,
        firstName?: string,
        fullName?: string,
        lastName?: string,
        documentNumber?: string,
        sex?: string
    }
    fullDocumentFrontImage?: IDCardImage
    fullDocumentBackImage?: IDCardImage
}

export interface DocumentDate {
    day: number
    month: number
    year: number
    successfullyParsed?: boolean
    originalString?: string
}

export interface Face {
    x: number
    y: number
    width: number
    height: number
    quality: number
}

export interface FrontPageResult extends BlinkIDResult {
    faces: Face[]
    authenticityScore?: number
    authenticityScores?: {
        [k: string]: number
    }
    imageQuality: ImageQuality
    imageSize: Size
}

export interface PassportPageResult extends BlinkIDResult {
    faces: Face[]
    imageQuality: ImageQuality
    imageSize: Size
}

export interface DriverLicenseDetailedInfo {
    restrictions: string
    endorsements: string
    vehicleClass: string
    conditions: string
}

export interface AddressDetailedInfo {
    street: string
    postalCode: string
    city: string
    jurisdiction: string
}

export interface ClassInfo {
    country: string
    region: string
    type: string
    countryName: string
    isoAlpha3CountryCode: string
    isoAlpha2CountryCode: string
    isoNumericCountryCode: string
}

export interface ImageAnalysisResult {
    blurred: boolean
    documentImageColorStatus: string
    documentImageMoireStatus: string
    faceDetectionStatus: string
    mrzDetectionStatus: string
    barcodeDetectionStatus: string
}

export type RecognizerType = "BLINK_ID" | "USDL" | "PASSPORT"

export interface PassportResult {
    face: DetectFaceResponse
    primaryID: string
    secondaryID: string
    documentCode: string
    documentNumber: string
    documentType: string
    issuer: string
    issuerName: string
    sex: string
    nationality: string
    nationalityName: string
    dateOfBirth: DocumentDate
    dateOfExpiry: DocumentDate
    alienNumber: string
    applicationReceiptNumber: string
    immigrantCaseNumber: string
    mrtdVerified: boolean
    opt1: string
    opt2: string
    rawMRZString: string
    recognitionStatus: string
    age: number
    isBelowAgeLimit: boolean
}

export interface USDLResult {
    rawDataBase64: string
    rawStringData: string
    uncertain: boolean
    recognitionStatus: string
    firstName: string
    lastName: string
    fullName: string
    address: string
    dateOfBirth: DocumentDate
    dateOfIssue: DocumentDate
    dateOfExpiry: DocumentDate
    documentNumber: string
    sex: string
    restrictions: string
    endorsements: string
    vehicleClass: string
    street: string
    postalCode: string
    city: string
    jurisdiction: string
    middleName: string
    nameSuffix: string
    DEPRECATED: string[]
    documentType: string
    standardVersionNumber: string
    customerFamilyName: string
    customerFirstName: string
    customerFullName: string
    eyeColor: string
    addressStreet: string
    addressCity: string
    addressJurisdictionCode: string
    addressPostalCode: string
    fullAddress: string
    height: string
    heightIn: string
    heightCm: string
    customerMiddleName: string
    hairColor: string
    AKAFullName: string
    AKAFamilyName: string
    AKAGivenName: string
    AKASuffixName: string
    weightRange: string
    weightPounds: string
    weightKilograms: string
    customerIdNumber: string
    familyNameTruncation: string
    firstNameTruncation: string
    middleNameTruncation: string
    placeOfBirth: string
    addressStreet2: string
    raceEthnicity: string
    namePrefix: string
    countryIdentification: string
    residenceStreetAddress: string
    residenceStreetAddress2: string
    residenceCity: string
    residenceJurisdictionCode: string
    residencePostalCode: string
    residenceFullAddress: string
    under18: string
    under19: string
    under21: string
    socialSecurityNumber: string
    AKASocialSecurityNumber: string
    AKAMiddleName: string
    AKAPrefixName: string
    organDonor: string
    veteran: string
    AKADateOfBirth: string
    issuerIdentificationNumber: string
    documentExpirationDate: string
    jurisdictionVersionNumber: string
    jurisdictionVehicleClass: string
    jurisdictionRestrictionCodes: string
    jurisdictionEndorsementCodes: string
    documentIssueDate: string
    federalCommercialVehicleCodes: string
    issuingJurisdiction: string
    standardVehicleClassification: string
    issuingJurisdictionName: string
    standardEndorsementCode: string
    standardRestrictionCode: string
    jurisdictionVehicleClassificationDescription: string
    jurisdictionEndorsmentCodeDescription: string
    jurisdictionRestrictionCodeDescription: string
    inventoryControlNumber: string
    cardRevisionDate: string
    documentDiscriminator: string
    limitedDurationDocument: string
    auditInformation: string
    complianceType: string
    issueTimestamp: string
    permitExpirationDate: string
    permitIdentifier: string
    permitIssueDate: string
    numberOfDuplicates: string
    HAZMATExpirationDate: string
    medicalIndicator: string
    nonResident: string
    uniqueCustomerId: string
    dataDiscriminator: string
    documentExpirationMonth: string
    documentNonexpiring: string
    securityVersion: string
    age: number
    isBelowAgeLimit: boolean
}

export interface BlinkIDResult {
    face: DetectFaceResponse
    dateOfBirth: DocumentDate
    classInfo: ClassInfo
    type: string
    isBelowAgeLimit: boolean
    age: number
    recognitionStatus: string
    firstName: string
    lastName: string
    fullName: string
    address: string
    dateOfIssue: DocumentDate
    dateOfExpiry: DocumentDate
    documentNumber: string
    sex: string
    driverLicenseDetailedInfo: DriverLicenseDetailedInfo
    fullDocumentImageBase64: string
    faceImageBase64: string
    additionalNameInformation: string
    additionalAddressInformation: string
    placeOfBirth: string
    nationality: string
    race: string
    religion: string
    profession: string
    maritalStatus: string
    residentialStatus: string
    employer: string
    personalIdNumber: string
    documentAdditionalNumber: string
    documentOptionalAdditionalNumber: string
    issuingAuthority: string
    mrzData: {
        rawMrzString: string,
        documentCode: string,
        issuer: string,
        documentNumber: string,
        opt1: string,
        opt2: string,
        gender: string,
        nationality: string,
        primaryId: string,
        secondaryId: string,
        alienNumber: string,
        applicationReceiptNumber: string,
        immigrantCaseNumber: string,
        mrzVerified: boolean,
        mrzParsed: boolean,
        dateOfBirth: DocumentDate,
        dateOfExpiry: DocumentDate,
        documentType: string,
        issuerName: string,
        nationalityName: string
    }
    conditions: string
    localizedName: string
    dateOfExpiryPermanent: boolean
    additionalPersonalIdNumber: string
    viz: {
        firstName: string,
        lastName: string,
        fullName: string,
        additionalNameInformation: string,
        localizedName: string,
        address: string,
        additionalAddressInformation: string,
        placeOfBirth: string,
        nationality: string,
        race: string,
        religion: string,
        profession: string,
        maritalStatus: string,
        residentialStatus: string,
        employer: string,
        sex: string,
        dateOfBirth: DocumentDate,
        dateOfIssue: DocumentDate,
        dateOfExpiry: DocumentDate,
        dateOfExpiryPermanent: boolean,
        documentNumber: string,
        personalIdNumber: string,
        documentAdditionalNumber: string,
        additionalPersonalIdNumber: string,
        documentOptionalAdditionalNumber: string,
        issuingAuthority: string,
        driverLicenseDetailedInfo: DriverLicenseDetailedInfo,
        conditions: string
    }
    barcode: {
        rawDataBase64: string,
        stringData: string,
        firstName: string,
        lastName: string,
        middleName: string,
        fullName: string,
        additionalNameInformation: string,
        address: string,
        placeOfBirth: string,
        nationality: string,
        race: string,
        religion: string,
        profession: string,
        maritalStatus: string,
        residentialStatus: string,
        employer: string,
        sex: string,
        dateOfBirth: DocumentDate,
        dateOfIssue: DocumentDate,
        dateOfExpiry: DocumentDate,
        documentNumber: string,
        personalIdNumber: string,
        documentAdditionalNumber: string,
        issuingAuthority: string,
        addressDetailedInfo: AddressDetailedInfo,
        driverLicenseDetailedInfo: DriverLicenseDetailedInfo,
        extendedElements: string[]
    }
    imageAnalysisResult: ImageAnalysisResult
    processingStatus: string
    recognitionMode: string
    signatureImageBase64: string
}

export interface BlinkIDResponse<T extends RecognizerType> {
    code: string
    summary: string
    executionId: string
    data: {
        result: IdCaptureResult<T>,
        durationTimeInSeconds: number,
        finishTime: string,
        workerId: number,
        startTime: string,
        recognizer: T,
        version: string,
        taskId: number
    }
}

export interface Size {
    width: number
    height: number
}

export interface ImageQuality {
    brightness: number
    contrast: number
    sharpness: number
}

export interface FaceDetectionResponse {
    faces: Face[]
    imageQuality?: ImageQuality
    authenticityScore?: number
    authenticityScores?: {[k: string]: number}
}

export interface QueueImageOptions {
    detector_version?: number
    classifiers?: (number | string)[][]
}

export const DocumentPage: {[k in RecognizerType]:string} = {
    BLINK_ID: "front",
    USDL: "back",
    PASSPORT: "passport"
}

export type WaitOptions = "one" | "all"

export type IdCaptureResult<T extends RecognizerType> = T extends "USDL" ? USDLResult : (T extends "PASSPORT" ? PassportResult : BlinkIDResult);