import { cn } from '../lib/cn';

export function WinMeter({
  winRate,
  confidence,
  size = 'md',
  showLabels = true,
}: {
  winRate: number;
  confidence?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
}) {
  const blue = Math.max(0, Math.min(100, winRate));
  const red = 100 - blue;
  const edge = blue - 50;
  return (
    <div className={cn('win-meter', `win-meter--${size}`)}>
      <div className="win-meter__numbers">
        <div className="win-meter__side win-meter__side--blue">
          <span className="win-meter__label">Blue side</span>
          <strong>{blue.toFixed(1)}%</strong>
        </div>
        <div className="win-meter__mid">
          <span className={cn('win-meter__edge', edge >= 0 ? 'is-positive' : 'is-negative')}>
            {edge >= 0 ? '+' : ''}
            {edge.toFixed(1)}
          </span>
          <em>projected edge</em>
        </div>
        <div className="win-meter__side win-meter__side--red">
          <span className="win-meter__label">Red side</span>
          <strong>{red.toFixed(1)}%</strong>
        </div>
      </div>
      <div
        className="win-meter__bar"
        role="meter"
        aria-label="Projected win probability"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(blue)}
      >
        <span className="win-meter__fill win-meter__fill--blue" style={{ width: `${blue}%` }} />
        <span className="win-meter__fill win-meter__fill--red" style={{ width: `${red}%` }} />
        <span className="win-meter__tick" style={{ left: '50%' }} />
        <span className="win-meter__marker" style={{ left: `${blue}%` }} />
      </div>
      {showLabels && (
        <div className="win-meter__foot">
          <span>Partial-board model</span>
          {confidence != null && (
            <span className={cn('win-meter__confidence', confidence < 0.55 && 'is-low')}>
              {Math.round(confidence * 100)}% confidence
            </span>
          )}
        </div>
      )}
    </div>
  );
}
