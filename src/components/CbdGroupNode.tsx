import { memo } from "react";
import type { NodeProps, Node } from "@xyflow/react";

export interface CbdGroupNodeData extends Record<string, unknown> {
  label: string;
}

export type CbdGroupNodeType = Node<CbdGroupNodeData, "cbdGroup">;

function CbdGroupNode({ data }: NodeProps<CbdGroupNodeType>) {
  return (
    <div
      title={`Concise Bounded Description of ${data.label}`}
      style={{
        width: "100%",
        height: "100%",
        border: "1px dashed rgba(99, 102, 241, 0.5)",
        borderRadius: 12,
        background: "rgba(99, 102, 241, 0.06)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          padding: "2px 8px",
          fontSize: 11,
          color: "rgba(79, 70, 229, 0.8)",
          fontWeight: 600,
        }}
      >
        {data.label}
      </div>
    </div>
  );
}

export default memo(CbdGroupNode);
