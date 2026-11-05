import * as React from "react";
import { Card, Skeleton } from "./ui";

/**
 * Placeholder shown while performance data is loading. It sketches the page
 * (summary tiles, then a table) so the real content lands without a jump.
 */
export const LoadingSkeleton: React.FC = () => (
  <div aria-busy="true" aria-label="Loading content" data-testid="loading-skeleton">
    <div className="ax-metrics">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="ax-metric">
          <Skeleton style={{ width: "45%" }} />
          <Skeleton variant="value" />
        </div>
      ))}
    </div>
    <Card>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} style={{ width: i === 0 ? "30%" : "100%", height: 16 }} />
      ))}
    </Card>
  </div>
);
