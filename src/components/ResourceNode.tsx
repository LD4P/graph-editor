import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { RdfProperty, RdfType } from "../model/rdfGraphModel";
import { deleteProperty, deleteType } from "../lib/pyBridge";
import { useGraphStore } from "../state/graphStore";

export interface ResourceNodeData extends Record<string, unknown> {
  iri: string;
  label: string;
  types: RdfType[];
  properties: RdfProperty[];
}

export type ResourceNode = Node<ResourceNodeData, "resource">;

function formatProperty(property: RdfProperty): string {
  if (property.language) return `${property.value} (@${property.language})`;
  if (property.datatype) return `${property.value} (${property.datatype})`;
  return property.value;
}

export default function ResourceNode({ id, data, selected }: NodeProps<ResourceNode>) {
  const setProjection = useGraphStore((state) => state.setProjection);

  async function handleDeleteType(type: RdfType) {
    setProjection(await deleteType(id, type.typeIri));
  }

  async function handleDeleteProperty(property: RdfProperty) {
    setProjection(
      await deleteProperty(id, property.predicateIri, property.value, property.datatype, property.language),
    );
  }

  return (
    <div
      style={{
        border: selected ? "2px solid #4a6cf7" : "1px solid #999",
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
            key={type.typeIri}
            style={{
              background: "#eef",
              borderRadius: 4,
              padding: "0 4px",
              fontWeight: 400,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            {type.type}
            <button
              title="Remove type"
              onClick={() => handleDeleteType(type)}
              style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {data.properties.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {data.properties.map((property, index) => (
              <tr key={`${property.predicateIri}-${index}`}>
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
                <td style={{ padding: "2px 8px" }}>{formatProperty(property)}</td>
                <td style={{ padding: "2px 4px" }}>
                  <button
                    title="Remove property"
                    onClick={() => handleDeleteProperty(property)}
                    style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
