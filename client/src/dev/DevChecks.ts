import { DEV_CHECKS, NETCODE } from "@stargazing/shared";

export type DevCheckLevel = "pass" | "warn" | "fail";

export interface DevCheckResult {
  id: string;
  label: string;
  level: DevCheckLevel;
  detail: string;
}

export interface DevCheckSample {
  nowMs: number;
  elapsedMs: number;
  dt: number;
  hasInitialSnapshot: boolean;
  snapshotAgeMs: number | null;
  inputGap: number;
  pendingInputs: number;
  correctionDistance: number;
  remoteCount: number;
  remoteAgeMs: number;
  remoteHolding: boolean;
  serverTimeOffsetJumpMs: number;
  localPoseFinite: boolean;
  localVelocityFinite: boolean;
}

export class DevChecks {
  private results = new Map<string, DevCheckResult>();
  private lastConsoleWarnMs = new Map<string, number>();

  constructor() {
    this.runStaticChecks();
  }

  update(sample: DevCheckSample): readonly DevCheckResult[] {
    this.set(
      "frame-dt",
      "Frame dt",
      sample.dt * 1000 > DEV_CHECKS.MAX_FRAME_DT_WARN_MS ? "warn" : "pass",
      `${(sample.dt * 1000).toFixed(1)}ms`,
      sample.nowMs,
    );

    this.set(
      "initial-snapshot",
      "Initial snapshot",
      !sample.hasInitialSnapshot &&
        sample.elapsedMs > DEV_CHECKS.STALE_INITIAL_SNAPSHOT_MS
        ? "warn"
        : "pass",
      sample.hasInitialSnapshot
        ? "received"
        : `waiting ${(sample.elapsedMs / 1000).toFixed(1)}s`,
      sample.nowMs,
    );

    const staleSnapshot =
      sample.snapshotAgeMs !== null &&
      sample.snapshotAgeMs > DEV_CHECKS.STALE_SNAPSHOT_WARN_MS;

    this.set(
      "snapshot-age",
      "Snapshot age",
      staleSnapshot ? "warn" : "pass",
      sample.snapshotAgeMs === null
        ? "none"
        : `${sample.snapshotAgeMs.toFixed(0)}ms`,
      sample.nowMs,
    );

    this.set(
      "input-backlog",
      "Input backlog",
      sample.inputGap > DEV_CHECKS.INPUT_GAP_WARN ||
        sample.pendingInputs > DEV_CHECKS.PENDING_INPUTS_WARN
        ? "warn"
        : "pass",
      `gap ${sample.inputGap}, pending ${sample.pendingInputs}`,
      sample.nowMs,
    );

    this.set(
      "prediction-correction",
      "Prediction correction",
      sample.correctionDistance > DEV_CHECKS.CORRECTION_WARN_DISTANCE
        ? "warn"
        : "pass",
      sample.correctionDistance.toFixed(2),
      sample.nowMs,
    );

    const remoteLevel =
      sample.remoteCount > 0 &&
      (sample.remoteHolding ||
        sample.remoteAgeMs > DEV_CHECKS.STALE_REMOTE_WARN_MS)
        ? "warn"
        : "pass";

    this.set(
      "remote-interpolation",
      "Remote interpolation",
      remoteLevel,
      sample.remoteCount === 0
        ? "no remotes"
        : `${sample.remoteAgeMs.toFixed(0)}ms ${sample.remoteHolding ? "hold" : "buffered"}`,
      sample.nowMs,
    );

    this.set(
      "server-time-offset",
      "Server time offset",
      sample.serverTimeOffsetJumpMs >
        DEV_CHECKS.SERVER_TIME_OFFSET_JUMP_WARN_MS
        ? "warn"
        : "pass",
      `${sample.serverTimeOffsetJumpMs.toFixed(1)}ms jump`,
      sample.nowMs,
    );

    this.set(
      "local-state-finite",
      "Local state finite",
      sample.localPoseFinite && sample.localVelocityFinite ? "pass" : "fail",
      sample.localPoseFinite && sample.localVelocityFinite
        ? "pose + velocity ok"
        : "non-finite local ship state",
      sample.nowMs,
    );

    return this.all();
  }

  all(): readonly DevCheckResult[] {
    return [...this.results.values()];
  }

  private runStaticChecks(): void {
    const expectedTickDt = 1 / NETCODE.TICK_HZ;
    this.set(
      "netcode-tick-dt",
      "Netcode tick dt",
      Math.abs(NETCODE.TICK_DT - expectedTickDt) < 0.000001 ? "pass" : "fail",
      `${NETCODE.TICK_HZ}Hz -> ${NETCODE.TICK_DT.toFixed(5)}s`,
      0,
    );

    this.set(
      "netcode-rates",
      "Netcode rates",
      NETCODE.INPUT_SEND_HZ > 0 &&
        NETCODE.SNAPSHOT_RATE_HZ > 0 &&
        NETCODE.ROOM_LOOP_HZ > 0
        ? "pass"
        : "fail",
      `input ${NETCODE.INPUT_SEND_HZ}Hz, snapshot ${NETCODE.SNAPSHOT_RATE_HZ}Hz`,
      0,
    );

    this.set(
      "netcode-buffers",
      "Netcode buffers",
      NETCODE.MAX_BUFFERED_INPUTS > 0 &&
        NETCODE.MAX_QUEUED_INPUTS > 0 &&
        NETCODE.INTERPOLATION_MAX_BUFFER_MS > NETCODE.INTERPOLATION_DELAY_MS
        ? "pass"
        : "fail",
      `inputs ${NETCODE.MAX_BUFFERED_INPUTS}, interp ${NETCODE.INTERPOLATION_MAX_BUFFER_MS}ms`,
      0,
    );
  }

  private set(
    id: string,
    label: string,
    level: DevCheckLevel,
    detail: string,
    nowMs: number,
  ): void {
    this.results.set(id, { id, label, level, detail });

    if (level === "pass") return;

    const lastWarn = this.lastConsoleWarnMs.get(id) ?? -Infinity;
    if (nowMs - lastWarn < DEV_CHECKS.CONSOLE_WARN_INTERVAL_MS) return;

    this.lastConsoleWarnMs.set(id, nowMs);
    console.warn(`[DevCheck:${level}] ${label}: ${detail}`);
  }
}
