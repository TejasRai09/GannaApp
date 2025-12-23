
export type UserRole = 'superadmin' | 'admin' | 'user' | 'viewer';

export interface User {
    id: string; // e.g., user_a1b2c3d4
    email: string;
    password?: string;
    name: string;
    organizationId: string;
    role: UserRole;
    createdAt: string; // ISO 8601 string
}

export interface Organization {
    id: string; // e.g., org_a1b2c3d4
    name: string;
    createdAt: string; // ISO 8601 string
    status: 'active' | 'suspended';
    customLogoBase64?: string;
}

export type ActivityType = 'ORG_CREATE' | 'USER_CREATE_ADMIN' | 'USER_CREATE_MEMBER';

export interface ActivityLog {
    id: string; // e.g., log_a1b2c3d4
    timestamp: string; // ISO 8601 string
    type: ActivityType;
    actorId: string; // User ID of who performed the action
    targetId: string; // ID of the created org or user
    details: {
        actorName: string;
        targetName: string;
        organizationName?: string;
    };
}

export type SupportTicketStatus = 'open' | 'in_progress' | 'closed';
export type SupportTicketTeam = 'technical' | 'billing' | 'general';

export interface SupportTicket {
    id: string;
    timestamp: string; // ISO 8601
    userId: string;
    userName: string;
    userEmail: string;
    organizationId: string;
    organizationName: string;
    team: SupportTicketTeam;
    subject: string;
    description: string;
    fileUrl?: string;
    status: SupportTicketStatus;
}


export interface Bonding {
    Code: string;
    Center: string;
    Bonding: string;
}

export interface Indent {
    Code: string;
    'Center Name': string;
    'Indent Date': string;
    'No of Purchy': string;
    'Qty in Qtls': string;
}

export interface Purchase {
    Code: string;
    'Center Name': string;
    'Purchase Date': string;
    'Indent Date': string;
    'No of Purchy': string;
    'Qty in Qtls': string;
}

// Wrapper for data stored in localStorage
export interface StoredData<T> {
    fileName: string;
    lastUpdated: string; // ISO 8601 string
    data: T[];
}

export type ConstraintType = 'mill' | 'field';

export interface Constraint {
    id: string;
    date: string; // ISO Date string YYYY-MM-DD
    type: ConstraintType;
    impactFactor: number; // 0.0 to 1.0 (percentage reduction)
    description?: string;
}

export interface RiskAnalysisItem {
    date: Date;
    type: ConstraintType;
    originalValue: number;
    constrainedValue: number;
    deficit: number;
    message: string;
}

// FIX: Moved CalculationInputs interface from calculationService.ts to here to break a circular dependency.
export interface CalculationInputs {
    bondingData: Bonding[];
    indentData: Indent[];
    purchaseData: Purchase[];
    plantCapacity: number;
    totalDailyRequirement: number;
    currentDate: Date;
    centerMapping: { [key: string]: string };
    standardStockCentre: number;
    standardStockGate: number;
    availableStockCentre: number;
    availableStockGate: number;
    plantStartDate: string;
    seasonTotalDays: number;
    seasonalCrushingCapacity: number;
    constraints: Constraint[];
}


// Internal, normalized types
export interface NormalizedIndent {
    centreId: string;
    raisedFor: Date;
    qty: number;
}

export interface NormalizedPurchase {
    centreId: string;
    purchaseDate: Date;
    raisedFor: Date | null;
    qty: number;
}

export interface NormalizedBonding {
    centreId: string;
    centreName: string;
    qty: number;
    isGate: boolean;
}

export interface DWeights {
    d1: number;
    d2: number;
    d3: number;
    d4: number;
}

export interface IndentResultRow {
    centreId: string;
    centreName: string;
    bonding: number;
    adjusted: number;
    forecastT3: number;
    indentToRaise: number;
}

export interface ClosedIndentAnalysis {
    centreId: string;
    centreName: string;
    raisedFor: Date;
    indentQty: number;
    d1Purchases: number;
    d2Purchases: number;
    d3Purchases: number;
    d4Purchases: number;
    totalPurchases: number;
}

export interface CenterDWeights {
    centreId: string;
    centreName: string;
    d1: number;
    d2: number;
    d3: number;
    d4: number;
    // Add flags to track if a fallback was used
    d1_fallback_used?: boolean;
    d2_fallback_used?: boolean;
    d3_fallback_used?: boolean;
    d4_fallback_used?: boolean;
    // Add the recent averages used for the fallback decision
    recent_avg_d1?: number;
    recent_avg_d2?: number;
    recent_avg_d3?: number;
    recent_avg_d4?: number;
}

export interface ForecastContribution {
    indentDate: Date | null;
    indentQty: number;
    weight: number;
    result: number;
}

export interface ForecastBreakdownRow {
    centreId: string;
    centreName: string;
    bonding: number;
    contributions: {
        d1: ForecastContribution;
        d2: ForecastContribution;
        d3: ForecastContribution;
        d4: ForecastContribution;
    };
    totalForecast: number;
}

export interface OpenIndentMatrixEntry {
    purchaseDate: Date;
    quantity: number;
    type: 'Actual' | 'Forecast';
    // New fields for the modal
    dWeight?: number;
    dWeightLabel?: 'D1' | 'D2' | 'D3' | 'D4';
    indentQty?: number;
}

export interface OpenIndentMatrixRow {
    indentDate: Date;
    indentQty: number;
    entries: OpenIndentMatrixEntry[];
}

export interface OpenIndentMatrixData {
    centreId: string;
    centreName: string;
    data: OpenIndentMatrixRow[];
}

export interface IndentCalculationBreakdownRow {
    centreId: string;
    centreName: string;
    // Step 1
    effectiveRequirement: number;
    bonding: number;
    totalBonding: number;
    bondingPercentage: number;
    requirementByBonding: number;
    // Step 2
    stockAdjustment: number;
    adjustedRequirement: number;
    // Step 3
    forecastT3: number;
    netRequirement: number;
    // Step 4
    overrunPercentage: number;
    targetArrival: number;
    // Step 5
    d1Weight: number;
    finalIndent: number; // this is `indentToRaise` in tableData
}

export interface CalculationResults {
    dWeights: DWeights; // Global weights
    overrunPercentage: number;
    effectiveRequirement: number;
    totalForecastT3: number;
    tableData: IndentResultRow[]; // Final recommendation table
    
    // Intermediate data for detailed view
    closedIndentAnalysis: ClosedIndentAnalysis[]; // T-7 to T-4 for existing tab
    centerDWeights: CenterDWeights[];
    forecastBreakdown: ForecastBreakdownRow[];
    maturityAnalysisPurchases: NormalizedPurchase[];
    openIndentMatrix: OpenIndentMatrixData[];
    openIndentMatrixHeaders: Date[];
    indentCalculationBreakdown: IndentCalculationBreakdownRow[];

    // Data for new Full Maturity Analysis tab
    fullSeasonAnalysis: ClosedIndentAnalysis[]; 
    seasonDWeights: CenterDWeights[];
    
    // Phase 3: Risk Analysis
    riskAnalysis?: RiskAnalysisItem[];
}

export interface CalculationRun {
    id: string;
    name: string;
    timestamp: number;
    inputs: Omit<CalculationInputs, 'bondingData' | 'indentData' | 'purchaseData'>;
    results: CalculationResults;
    isScenario?: boolean;
    parentRunId?: string;
}