import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { NetworkDevice, DeviceType } from '../types';

interface TopologyMapProps {
  devices: NetworkDevice[];
  onContextMenu: (e: React.MouseEvent, device: NetworkDevice) => void;
}

const TopologyMap: React.FC<TopologyMapProps> = ({ devices, onContextMenu }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (wrapperRef.current) {
        setDimensions({
          width: wrapperRef.current.clientWidth,
          height: wrapperRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // D3 Logic
  useEffect(() => {
    if (!devices.length || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous

    const { width, height } = dimensions;
    
    // Zoom behavior
    const zoomGroup = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on("zoom", (event) => {
        zoomGroup.attr("transform", event.transform);
      });
    
    svg.call(zoom);

    // Initial transform to center roughly
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, 50).scale(1));

    // Data Preparation
    const validIds = new Set(devices.map(d => d.id));
    
    // Clean data
    let cleanDevices = devices.map(d => ({
      ...d,
      parentId: d.parentId && validIds.has(d.parentId) ? d.parentId : null
    }));

    // Handle orphans/multiple roots
    const roots = cleanDevices.filter(d => d.parentId === null);
    if (roots.length > 1) {
        const mainRoot = roots.find(r => r.type === DeviceType.ROUTER) || roots[0];
        cleanDevices = cleanDevices.map(d => {
            if (d.parentId === null && d.id !== mainRoot.id) {
                return { ...d, parentId: mainRoot.id };
            }
            return d;
        });
    }

    let root;
    try {
        const stratify = d3.stratify<NetworkDevice>()
            .id(d => d.id)
            .parentId(d => d.parentId);
        root = stratify(cleanDevices);
    } catch (e) {
        console.warn("Topology stratify failed:", e);
        zoomGroup.append("text")
           .attr("x", 0)
           .attr("y", 0)
           .attr("text-anchor", "middle")
           .attr("fill", "red")
           .text("Errore dati topologia");
        return; 
    }

    // Configurazione Card
    const nodeWidth = 180;
    const nodeHeight = 70;
    const horizontalSpacing = nodeWidth + 40;
    const verticalSpacing = nodeHeight + 60;

    const treeLayout = d3.tree<NetworkDevice>()
        .nodeSize([horizontalSpacing, verticalSpacing])
        .separation((a, b) => a.parent === b.parent ? 1.1 : 1.3);

    treeLayout(root);

    // Custom Orthogonal Link Generator
    const stepPath = (d: any) => {
        const sourceX = d.source.x;
        const sourceY = d.source.y + nodeHeight / 2; // Bottom center of source
        const targetX = d.target.x;
        const targetY = d.target.y - nodeHeight / 2; // Top center of target
        const midY = (sourceY + targetY) / 2;

        return `M${sourceX},${sourceY} 
                V${midY} 
                H${targetX} 
                V${targetY}`;
    };

    // Links
    zoomGroup.selectAll(".link")
      .data(root.links())
      .enter().append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#475569") // slate-600
      .attr("stroke-width", 2)
      .attr("d", stepPath);

    // Nodes Group
    const node = zoomGroup.selectAll(".node")
      .data(root.descendants())
      .enter().append("g")
      .attr("class", "node cursor-pointer hover:brightness-110 transition-all")
      .attr("transform", (d: any) => `translate(${d.x},${d.y})`)
      .on("contextmenu", (event, d) => {
          onContextMenu(event, d.data);
      });

    // 1. Rectangle Card Body
    node.append("rect")
      .attr("x", -nodeWidth / 2)
      .attr("y", -nodeHeight / 2)
      .attr("width", nodeWidth)
      .attr("height", nodeHeight)
      .attr("rx", 6) // Rounded corners
      .attr("ry", 6)
      .attr("fill", "#1e293b") // slate-800
      .attr("stroke", d => {
          switch(d.data.type) {
              case DeviceType.ROUTER: return "#ef4444"; // Red
              case DeviceType.SWITCH: return "#3b82f6"; // Blue
              case DeviceType.SERVER: return "#8b5cf6"; // Purple
              case DeviceType.PRINTER: return "#f59e0b"; // Yellow
              case DeviceType.MOBILE: return "#10b981"; // Green
              default: return "#64748b"; // Slate
          }
      })
      .attr("stroke-width", 2)
      .style("filter", "drop-shadow(3px 3px 5px rgba(0,0,0,0.5))"); // Shadow

    // 2. Icon Area Background (Left side)
    node.append("path")
      .attr("d", `M${-nodeWidth/2 + 1},${-nodeHeight/2 + 1} 
                  h35 
                  v${nodeHeight - 2} 
                  h-35 
                  a5,5 0 0 1 -5,-5 
                  v-${nodeHeight - 12} 
                  a5,5 0 0 1 5,-5 z`)
      .attr("fill", d => {
          switch(d.data.type) {
              case DeviceType.ROUTER: return "#ef444420"; 
              case DeviceType.SWITCH: return "#3b82f620";
              default: return "#ffffff05";
          }
      });

    // 3. Icon Text
    node.append("text")
      .attr("x", -nodeWidth / 2 + 18)
      .attr("y", 4)
      .attr("text-anchor", "middle")
      .style("font-family", "monospace")
      .style("font-size", "10px")
      .style("font-weight", "bold")
      .style("fill", d => {
        switch(d.data.type) {
            case DeviceType.ROUTER: return "#ef4444"; 
            case DeviceType.SWITCH: return "#3b82f6";
            default: return "#94a3b8";
        }
      })
      .text(d => {
          switch(d.data.type) {
              case DeviceType.ROUTER: return "R";
              case DeviceType.SWITCH: return "SW";
              case DeviceType.SERVER: return "SRV";
              case DeviceType.PRINTER: return "PRN";
              case DeviceType.MOBILE: return "MB";
              default: return "PC";
          }
      });

    // 4. Device Name (Top Line)
    node.append("text")
      .attr("x", -nodeWidth / 2 + 45)
      .attr("y", -nodeHeight / 2 + 25)
      .attr("text-anchor", "start")
      .style("font-size", "12px")
      .style("font-weight", "bold")
      .style("fill", "#e2e8f0")
      .text(d => {
          const name = d.data.name;
          return name.length > 18 ? name.substring(0, 16) + "..." : name;
      });

    // 5. IP Address (Bottom Line)
    node.append("text")
      .attr("x", -nodeWidth / 2 + 45)
      .attr("y", -nodeHeight / 2 + 45)
      .attr("text-anchor", "start")
      .style("font-family", "monospace")
      .style("font-size", "11px")
      .style("fill", "#94a3b8")
      .text(d => d.data.ip);

    // 6. Status Indicator (Dot)
    node.append("circle")
        .attr("cx", nodeWidth / 2 - 10)
        .attr("cy", -nodeHeight / 2 + 10)
        .attr("r", 4)
        .attr("fill", d => d.data.status === 'online' ? '#10b981' : '#ef4444');

  }, [devices, dimensions, onContextMenu]);

  return (
    <div ref={wrapperRef} className="w-full h-full bg-slate-900 rounded-lg border border-slate-700 overflow-hidden relative shadow-inner">
        <div className="absolute top-4 left-4 z-10 bg-slate-800/90 backdrop-blur p-3 rounded-lg border border-slate-700 text-xs text-slate-300 shadow-lg flex gap-4">
           <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-800 border-2 border-red-500 rounded sm"></div> Router</div>
           <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-800 border-2 border-blue-500 rounded sm"></div> Switch</div>
           <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-800 border-2 border-green-500 rounded sm"></div> Client</div>
           <span className="text-slate-500">| Scroll per Zoom, Drag per Pan</span>
        </div>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="block cursor-grab active:cursor-grabbing" />
    </div>
  );
};

export default TopologyMap;