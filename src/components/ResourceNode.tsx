import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { RdfProperty } from "../model/rdfGraphModel";

export interface ResourceNodeData extends Record<string, unknown> {
  iri: string;
  label: string;
  types: string[];
  properties: RdfProperty[];
}

export type ResourceNode = Node<ResourceNodeData, "resource">;

function formatProperty(property: RdfProperty): string {
  if (property.language) return `${property.value} (@${property.language})`;
  if (property.datatype) return `${property.value} (${property.datatype})`;
  return property.value;
}

export default function ResourceNode({ data }: NodeProps<ResourceNode>) {
  return (
    <div
      style={{
        border: "1px solid #999",
        borderRadius: 6,
        background: "white",
        minWidth: 200,
        fontSize: 12,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      <div
        title={data.iri}
        style={{
          padding: "4px 8px",
          borderBottom: "1px solid #ddd",
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span>{data.label}</span>
        {data.types.map((type) => (
          <span
            key={type}
            style={{
              background: "#eef",
              borderRadius: 4,
              padding: "0 4px",
              fontWeight: 400,
            }}
          >
            {type}
          </span>
        ))}
      </div>
      {data.properties.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {data.properties.map((property, index) => (
              <tr key={`${property.predicate}-${index}`}>
                <td
                  style={{
                    padding: "2px 8px",
                    color: "#555",
                    verticalAlign: "top",
                    whiteSpace: "nowrap",
                  }}
                >
                  {property.predicate}
                </td>
                <td style={{ padding: "2px 8px" }}>
                  {formatProperty(property)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
