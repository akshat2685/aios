// ─── Phase 10: Future Vision — Shared Type Definitions ──────────────────────

// ============================================================================
// 1. Knowledge Graph Visualization Types
// ============================================================================

export type GraphVizNodeType = 'memory' | 'chat' | 'project' | 'file' | 'task' | 'agent' | 'preference' | 'goal';

export interface GraphVizNode {
  id: string;
  type: GraphVizNodeType;
  label: string;
  properties: Record<string, any>;
  /** Position in 2D layout space */
  x: number;
  y: number;
  /** Visual weight (affects node size) */
  weight: number;
  /** Cluster ID for grouping */
  clusterId?: string;
  /** Timestamp of creation */
  createdAt: number;
  /** Last accessed timestamp */
  lastAccessedAt: number;
}

export interface GraphVizEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: string; // e.g., 'CREATED', 'REFERENCES', 'DEPENDS_ON', 'ASSIGNED_TO'
  weight: number;
  confidence: number;
  label?: string;
}

export type GraphLayoutAlgorithm = 'force-directed' | 'hierarchical' | 'radial' | 'grid';

export interface GraphLayout {
  algorithm: GraphLayoutAlgorithm;
  /** Node positions keyed by node ID */
  positions: Record<string, { x: number; y: number }>;
  /** Computed clusters */
  clusters: GraphCluster[];
  /** Layout computation timestamp */
  computedAt: number;
}

export interface GraphCluster {
  id: string;
  label: string;
  nodeIds: string[];
  centroidX: number;
  centroidY: number;
  color: string;
}

export interface GraphFilter {
  nodeTypes?: GraphVizNodeType[];
  timeRange?: { start: number; end: number };
  searchQuery?: string;
  minWeight?: number;
  maxDepth?: number;
  clusterId?: string;
}

export interface GraphVizConfig {
  layout: GraphLayoutAlgorithm;
  showLabels: boolean;
  showEdgeLabels: boolean;
  particleEffects: boolean;
  clusterHighlight: boolean;
  maxVisibleNodes: number;
}

export interface GraphSnapshot {
  nodes: GraphVizNode[];
  edges: GraphVizEdge[];
  layout: GraphLayout;
  stats: GraphStats;
}

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  clusterCount: number;
  averageDegree: number;
  density: number;
}

// ============================================================================
// 2. Digital Twin Types
// ============================================================================

export interface CodingStyleProfile {
  /** Preferred indentation: 'tabs' | 'spaces-2' | 'spaces-4' */
  indentation: string;
  /** Preferred naming convention: 'camelCase' | 'snake_case' | 'PascalCase' */
  namingConvention: string;
  /** Comment density: 0.0 (no comments) to 1.0 (heavily commented) */
  commentDensity: number;
  /** Preferred frameworks and libraries */
  preferredFrameworks: string[];
  /** Preferred languages ranked by usage */
  preferredLanguages: string[];
  /** Code complexity preference: 'simple' | 'moderate' | 'complex' */
  complexityPreference: string;
  /** Prefers functional vs OOP style: 0.0 = pure OOP, 1.0 = pure functional */
  functionalVsOop: number;
  /** Average function length preference */
  avgFunctionLength: number;
  /** Type strictness: 'any-heavy' | 'moderate' | 'strict' */
  typeStrictness: string;
}

export interface TonePreference {
  /** Formality: 0.0 = very casual, 1.0 = very formal */
  formality: number;
  /** Verbosity: 0.0 = terse, 1.0 = very detailed */
  verbosity: number;
  /** Technical depth: 0.0 = high-level only, 1.0 = deep technical */
  technicalDepth: number;
  /** Emoji usage: 0.0 = never, 1.0 = frequent */
  emojiUsage: number;
  /** Preferred response structure: 'prose' | 'bullets' | 'mixed' */
  responseStructure: string;
}

export interface LongTermObjective {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  progress: number; // 0.0 to 1.0
  milestones: string[];
  completedMilestones: string[];
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  id: string;
  codingStyle: CodingStyleProfile;
  tone: TonePreference;
  objectives: LongTermObjective[];
  /** Raw observation count used to build this profile */
  observationCount: number;
  /** Profile confidence: 0.0 = no data, 1.0 = very confident */
  confidence: number;
  createdAt: number;
  updatedAt: number;
}

export interface StyleObservation {
  id: string;
  dimension: string; // e.g., 'indentation', 'namingConvention', 'tone.formality'
  observedValue: any;
  confidence: number;
  source: 'conversation' | 'code_diff' | 'explicit_statement' | 'behavior';
  timestamp: number;
}

export interface DigitalTwinSnapshot {
  profile: UserProfile;
  recentObservations: StyleObservation[];
  predictions: IntentPrediction[];
  generatedAt: number;
}

export interface IntentPrediction {
  id: string;
  predictedAction: string;
  confidence: number;
  reasoning: string;
  suggestedPrompt?: string;
  relatedObjectiveId?: string;
}

// ============================================================================
// 3. Simulation Sandbox Types
// ============================================================================

export type SandboxSessionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout';

export interface SandboxSession {
  id: string;
  name: string;
  status: SandboxSessionStatus;
  /** The plan or task being simulated */
  taskDescription: string;
  /** Virtual workspace root path */
  virtualWorkspacePath: string;
  /** Execution results for each step */
  executions: SandboxExecution[];
  /** Aggregated diff preview */
  diffSummary?: string;
  /** Resource usage */
  resources: SandboxResourceUsage;
  createdAt: number;
  completedAt?: number;
}

export interface SandboxExecution {
  stepIndex: number;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  filesCreated: string[];
  filesModified: string[];
  filesDeleted: string[];
}

export interface SandboxResult {
  sessionId: string;
  success: boolean;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  /** Unified diff of all changes */
  unifiedDiff: string;
  /** Confidence that real execution would succeed */
  confidence: number;
  warnings: string[];
}

export interface SandboxPolicy {
  /** Maximum execution time per step (ms) */
  maxStepTimeoutMs: number;
  /** Maximum total session time (ms) */
  maxSessionTimeoutMs: number;
  /** Maximum number of files that can be created */
  maxFileCount: number;
  /** Maximum total bytes that can be written */
  maxTotalBytes: number;
  /** Allowed commands whitelist (empty = all allowed) */
  allowedCommands: string[];
  /** Blocked commands blacklist */
  blockedCommands: string[];
  /** Allow network access in sandbox */
  allowNetworkAccess: boolean;
}

export interface SandboxResourceUsage {
  filesCreated: number;
  filesModified: number;
  filesDeleted: number;
  totalBytesWritten: number;
  elapsedMs: number;
}

// ============================================================================
// 4. Federated Multi-Agent Network Types
// ============================================================================

export type PeerStatus = 'online' | 'offline' | 'syncing' | 'error';

export interface PeerNode {
  id: string;
  /** Human-readable name */
  displayName: string;
  /** Public key for E2E encryption */
  publicKey: string;
  /** Network address */
  address: string;
  port: number;
  /** Peer status */
  status: PeerStatus;
  /** Advertised capabilities */
  capabilities: PeerCapability[];
  /** Last heartbeat timestamp */
  lastSeen: number;
  /** Average latency in ms */
  latencyMs: number;
}

export interface PeerCapability {
  type: 'agent' | 'model' | 'tool' | 'knowledge';
  name: string;
  description: string;
  version: string;
}

export type FederationMessageType =
  | 'agent:delegate'
  | 'knowledge:sync'
  | 'model:share'
  | 'heartbeat'
  | 'peer:announce'
  | 'peer:disconnect';

export interface FederationMessage {
  id: string;
  type: FederationMessageType;
  senderId: string;
  recipientId: string;
  payload: any;
  /** Encrypted flag */
  encrypted: boolean;
  timestamp: number;
  /** Correlation ID for request/response pairs */
  correlationId?: string;
}

export interface FederationProtocolConfig {
  /** Local peer identity */
  localPeerId: string;
  /** WebSocket server port */
  port: number;
  /** Enable mDNS discovery */
  enableMdns: boolean;
  /** Enable encryption */
  enableEncryption: boolean;
  /** Heartbeat interval in ms */
  heartbeatIntervalMs: number;
  /** Request timeout in ms */
  requestTimeoutMs: number;
}

export interface SharingPolicy {
  /** Share project data */
  shareProjects: boolean;
  /** Share knowledge graph */
  shareKnowledge: boolean;
  /** Share memory/preferences */
  shareMemory: boolean;
  /** Per-project sharing overrides */
  projectOverrides: Record<string, boolean>;
  /** Data types explicitly blocked from sharing */
  blockedDataTypes: string[];
}

export interface SyncManifest {
  peerId: string;
  /** Last sync timestamp */
  lastSyncAt: number;
  /** Nodes changed since last sync */
  changedNodeIds: string[];
  /** Edges changed since last sync */
  changedEdgeIds: string[];
  /** CRDT version vector */
  versionVector: Record<string, number>;
}

export interface FederationAuditEntry {
  id: string;
  peerId: string;
  action: FederationMessageType;
  direction: 'inbound' | 'outbound';
  dataSize: number;
  encrypted: boolean;
  success: boolean;
  timestamp: number;
}

// ============================================================================
// 5. Offline Personal Intelligence Types
// ============================================================================

export type LocalModelType = 'embedding' | 'stt' | 'tts' | 'ocr' | 'vision' | 'llm';
export type ModelStatus = 'not_downloaded' | 'downloading' | 'ready' | 'loaded' | 'error';

export interface LocalModelDescriptor {
  id: string;
  name: string;
  type: LocalModelType;
  /** Model file path relative to models directory */
  filePath: string;
  /** File size in bytes */
  fileSize: number;
  /** Quantization level (e.g., 'q4_0', 'q8_0', 'f16') */
  quantization?: string;
  /** Runtime format: 'onnx' | 'gguf' | 'safetensors' */
  format: string;
  status: ModelStatus;
  /** Download progress 0.0 to 1.0 */
  downloadProgress: number;
  /** Last used timestamp */
  lastUsedAt?: number;
  /** Model metadata */
  metadata: Record<string, any>;
}

export type OfflineCapabilityType = 'embeddings' | 'stt' | 'tts' | 'ocr' | 'vision';

export interface OfflineCapability {
  type: OfflineCapabilityType;
  enabled: boolean;
  modelId?: string;
  status: ModelStatus;
  /** Whether GPU acceleration is available for this capability */
  gpuAccelerated: boolean;
}

export interface OfflinePipelineConfig {
  /** Root directory for local models */
  modelsDirectory: string;
  /** Enable air-gapped mode (block all network requests) */
  airGappedMode: boolean;
  /** Capabilities configuration */
  capabilities: OfflineCapability[];
  /** GPU device ID (-1 = CPU only) */
  gpuDeviceId: number;
  /** Maximum memory budget for loaded models (bytes) */
  maxMemoryBudget: number;
}

export interface EmbeddingRequest {
  texts: string[];
  modelId?: string;
}

export interface EmbeddingResult {
  embeddings: number[][];
  modelId: string;
  dimensions: number;
  durationMs: number;
}

export interface STTRequest {
  /** Audio buffer (PCM or WAV) */
  audioBuffer: Buffer;
  language?: string;
  modelId?: string;
}

export interface STTResult {
  text: string;
  language: string;
  confidence: number;
  segments: Array<{ start: number; end: number; text: string }>;
  durationMs: number;
}

export interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
  modelId?: string;
}

export interface TTSResult {
  audioBuffer: Buffer;
  sampleRate: number;
  durationMs: number;
}

export interface OCRRequest {
  /** Image buffer (PNG, JPEG, etc.) */
  imageBuffer: Buffer;
  language?: string;
  modelId?: string;
}

export interface OCRResult {
  text: string;
  confidence: number;
  regions: Array<{
    text: string;
    bounds: { x: number; y: number; width: number; height: number };
    confidence: number;
  }>;
  durationMs: number;
}

export interface VisionAnalysisRequest {
  imageBuffer: Buffer;
  prompt?: string;
  modelId?: string;
}

export interface VisionAnalysisResult {
  caption: string;
  labels: Array<{ label: string; confidence: number }>;
  objects: Array<{
    label: string;
    bounds: { x: number; y: number; width: number; height: number };
    confidence: number;
  }>;
  durationMs: number;
}
