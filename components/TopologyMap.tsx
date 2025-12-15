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
    
    // Create hierarchy
    // 1. Find root (null parentId)
    // 2. Stratify
    
    let rootDevice = devices.find(d => d.type === DeviceType.ROUTER) || devices[0];
    
    const validIds = new Set(devices.map(d => d.id));
    const cleanDevices = devices.map(d => ({
      ...d,
      parentId: d.parentId && validIds.has(d.parentId) ? d.parentId : null
    }));

    let root;
    try {
        const stratify = d3.stratify<NetworkDevice>()
            .id(d => d.id)
            .parentId(d => d.parentId);
        
        root = stratify(cleanDevices);
    } catch (e) {
        console.warn("Topology stratify failed, using flat hierarchy", e);
        return; 
    }

    const treeLayout = d3.tree<NetworkDevice>().size([width - 100, height - 100]);
    treeLayout(root);

    const g = svg.append("g")
      .attr("transform", "translate(50, 50)");

    // Links
    g.selectAll(".link")
      .data(root.links())
      .enter().append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#475569")
      .attr("stroke-width", 2)
      .attr("d", d3.linkVertical()
        .x((d: any) => d.x)
        .y((d: any) => d.y) as any
      );

    // Nodes
    const node = g.selectAll(".node")
      .data(root.descendants())
      .enter().append("g")
      .attr("class", d => `node ${d.children ? "node--internal" : "node--leaf"} cursor-pointer hover:opacity-80 transition-opacity`)
      .attr("transform", (d: any) => `translate(${d.x},${d.y})`)
      .on("contextmenu", (event, d) => {
          onContextMenu(event as any, d.data);
      });

    // Node Circles (Background)
    node.append("circle")
      .attr("r", 20)
      .attr("fill", d => {
          switch(d.data.type) {
              case DeviceType.ROUTER: return "#ef4444"; // Red
              case DeviceType.SWITCH: return "#3b82f6"; // Blue
              case DeviceType.SERVER: return "#8b5cf6"; // Purple
              case DeviceType.PRINTER: return "#f59e0b"; // Yellow
              default: return "#10b981"; // Green (PC/Mobile)
          }
      })
      .attr("stroke", "#1e293b")
      .attr("stroke-width", 3);

    // Node Icons
    node.append("text")
      .attr("dy", 5)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "white")
      .style("pointer-events", "none")
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

    // Labels
    node.append("text")
      .attr("dy", 35)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("fill", "#cbd5e1")
      .text(d => d.data.name);
      
    node.append("text")
      .attr("dy", 48)
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("fill", "#64748b")
      .text(d => d.data.ip);

  }, [devices, dimensions, onContextMenu]);

  return (
    <div ref={wrapperRef} className="w-full h-full bg-slate-900 rounded-lg border border-slate-700 overflow-hidden relative shadow-inner">
        <div className="absolute top-4 left-4 z-10 bg-slate-800/80 backdrop-blur p-2 rounded text-xs text-slate-400">
            <h4 className="font-bold text-slate-200 mb-1">Legenda</h4>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span> Router</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500"></span> Switch</div>
            <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500"></span> Client</div>
        </div>
      <svg ref={svgRef} width={dimensions.width} height={dimensions.height} />
    </div>
  );
};

export default TopologyMap;