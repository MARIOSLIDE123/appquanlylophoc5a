import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { Student } from "../types";

interface Props {
  students: Student[];
}

export default function AnalyticsDashboard({ students }: Props) {
  const chartRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!chartRef.current || students.length === 0) return;

    // Clear previous SVG contents
    d3.select(chartRef.current).selectAll("*").remove();

    const margin = { top: 30, right: 30, bottom: 60, left: 60 };
    const width = 600 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    const svg = d3
      .select(chartRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Sort students by points descending
    const data = [...students].sort((a, b) => b.points - a.points).slice(0, 10); // Top 10

    // X axis
    const x = d3
      .scaleBand()
      .range([0, width])
      .domain(data.map((d) => d.name))
      .padding(0.2);

    svg
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "translate(-10,0)rotate(-45)")
      .style("text-anchor", "end")
      .style("font-size", "10px");

    // Add Y axis
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.points) || 100])
      .range([height, 0]);

    svg.append("g").call(d3.axisLeft(y));

    // Bars
    svg
      .selectAll("mybar")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.name) as number)
      .attr("y", (d) => y(d.points))
      .attr("width", x.bandwidth())
      .attr("height", (d) => height - y(d.points))
      .attr("fill", "#4F46E5") // Indigo-600
      .attr("rx", 4)
      .on("mouseover", function () {
        d3.select(this).attr("fill", "#3730A3"); // Indigo-800
      })
      .on("mouseout", function () {
        d3.select(this).attr("fill", "#4F46E5");
      });

    // Chart title
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", -10)
      .attr("text-anchor", "middle")
      .style("font-size", "16px")
      .style("font-weight", "bold")
      .style("font-family", "sans-serif")
      .text("Top 10 Học sinh có Điểm Thi Đua Cao Nhất");

  }, [students]);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col items-center">
      <h3 className="font-display font-extrabold text-slate-900 text-lg w-full mb-4">
        📈 Thống Kê Điểm Thi Đua
      </h3>
      <div className="overflow-x-auto w-full flex justify-center">
        <svg ref={chartRef}></svg>
      </div>
    </div>
  );
}
