from typing import List, Dict, Optional, Any, Literal
from pydantic import BaseModel, Field

class CellEdit(BaseModel):
    row: int = Field(..., ge=0, description="0-indexed row coordinate")
    col: int = Field(..., ge=0, description="0-indexed column coordinate")
    land_cover: str = Field(..., description="Target land cover type identifier")

class SimulateRequest(BaseModel):
    project_action: Literal['auto', 'road_widening', 'building_construction', 'parking_lot', 'green_restoration', 'custom'] = 'auto' 
    location_context_id: Optional[str] = Field(None, max_length=64)
    site_id: Optional[str] = Field("site_a", description="Site identifier (e.g. site_a, site_b)")
    rainfall_mm: float = Field(..., ge=0.0, le=1000, allow_inf_nan=False, description="Storm rainfall depth in millimeters")
    cell_area_m2: Optional[float] = Field(100.0, ge=1.0, allow_inf_nan=False, description="Area of each grid cell in square meters")
    edits: List[CellEdit] = Field(default_factory=list, description="List of cell modifications applied to baseline")
    elevation_matrix: Optional[List[List[float]]] = Field(None, description="Optional custom elevation grid")
    land_cover_matrix: Optional[List[List[str]]] = Field(None, description="Optional custom baseline land cover grid")

class FlowCellInfo(BaseModel):
    row: int
    col: int
    elevation: float
    land_cover_baseline: str
    land_cover_proposed: str
    c_baseline: float
    c_proposed: float
    runoff_baseline_m3: float
    runoff_proposed_m3: float
    delta_runoff_m3: float
    flow_direction_code: int # 0:E, 1:SE, 2:S, 3:SW, 4:W, 5:NW, 6:N, 7:NE, -1:Sink
    downstream_target: Optional[Dict[str, int]] = None
    flow_accumulation_baseline_m3: float
    flow_accumulation_proposed_m3: float
    is_downstream_affected: bool

class SimulateResponse(BaseModel):
    site_id: str
    grid_size: Dict[str, int]
    rainfall_mm: float
    cell_area_m2: float
    total_area_m2: float
    total_runoff_baseline_m3: float
    total_runoff_proposed_m3: float
    delta_runoff_m3: float
    percentage_change: Optional[float]
    edited_cells_count: int
    downstream_affected_cells_count: int
    cells: List[List[FlowCellInfo]]
    downstream_path_cells: List[Dict[str, int]]
    assumptions: Dict[str, Any]
    environmental_impact: Optional[Dict[str, Any]] = None
    neighborhood_impact: Optional[Dict[str, Any]] = None
    flood_history: Optional[Dict[str, Any]] = None

class OptimizeRequest(BaseModel):
    location_context_id: Optional[str] = Field(None, max_length=64)
    site_id: str = "site_a"
    rainfall_mm: float = Field(65.0, ge=0, le=1000)
    cell_area_m2: float = Field(100.0, gt=0)
    budget_usd: float = Field(..., ge=0.0, description="Available mitigation budget in USD")
    edits: List[CellEdit] = Field(default_factory=list, description="The proposed development scenario edits")
    preferred_mitigation_ids: Optional[List[str]] = Field(default=None, description="Filter to specific mitigation technologies")

class MitigationPlanOption(BaseModel):
    id: str
    name: str
    description: str
    mitigation_type: str
    applied_cells: List[Dict[str, Any]]
    total_cost_usd: float
    budget_usd: float
    remaining_budget_usd: float
    baseline_runoff_m3: float
    unmitigated_runoff_m3: float
    mitigated_runoff_m3: float
    runoff_reduction_m3: float
    reduction_percentage: float
    cost_efficiency_usd_per_m3: float
    trade_off_analysis: str

class OptimizeResponse(BaseModel):
    budget_usd: float
    candidate_options: List[MitigationPlanOption]
    recommended_option_id: Optional[str]
    summary: str

class DecisionReportRequest(BaseModel):
    site_id: str
    project_name: Optional[str] = "Proposed Parcel Development"
    rainfall_mm: float
    edits: List[CellEdit]
    simulation_result: Dict[str, Any]
    selected_mitigation: Optional[Dict[str, Any]] = None
    include_groundsource_evidence: bool = True

class DecisionReportResponse(BaseModel):
    markdown_report: str
    summary: str
    generated_at: str
    provenance_attribution: Dict[str, str]
