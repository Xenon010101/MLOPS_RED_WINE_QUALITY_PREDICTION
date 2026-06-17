document.addEventListener("DOMContentLoaded", function () {
    // Tab Navigation
    const navItems = document.querySelectorAll(".nav-item");
    const panels = document.querySelectorAll(".tab-panel");
    const tabTitle = document.getElementById("current-tab-title");
    const tabDesc = document.getElementById("current-tab-desc");

    const tabMeta = {
        xai: { title: "Explainable AI Insights", desc: "Evaluate local predictions and view global SHAP feature impact" },
        monitoring: { title: "Data Drift & Model Health", desc: "Track prediction request stats and statistical feature drift tests" },
        experiments: { title: "MLflow Experiment Tracking", desc: "View training parameters and model metrics history from MLflow" },
        benchmarks: { title: "Multi-Model Benchmark Framework", desc: "Compare R2 and RMSE across ElasticNet, RandomForest, GradientBoosting, and XGBoost" },
        analytics: { title: "Enterprise Reports & Trends", desc: "View prediction volumetric trends and generate downloadable CSV/PDF summaries" }
    };

    navItems.forEach(item => {
        item.addEventListener("click", () => {
            const tab = item.getAttribute("data-tab");
            
            navItems.forEach(n => n.classList.remove("active"));
            panels.forEach(p => p.classList.remove("active"));
            
            item.classList.add("active");
            document.getElementById(`tab-${tab}`).classList.add("active");

            tabTitle.textContent = tabMeta[tab].title;
            tabDesc.textContent = tabMeta[tab].desc;

            // Load data for the active tab dynamically
            loadTabContent(tab);
        });
    });

    // Charts references
    let localShapChart = null;
    let globalShapChart = null;
    let benchmarkChart = null;
    let trendsChart = null;

    // Load initial tab content
    loadTabContent("xai");

    function loadTabContent(tab) {
        if (tab === "xai") {
            loadGlobalShap();
        } else if (tab === "monitoring") {
            loadMonitoringData();
        } else if (tab === "experiments") {
            loadExperimentsData();
        } else if (tab === "benchmarks") {
            loadBenchmarksData();
        } else if (tab === "analytics") {
            loadAnalyticsData();
        }
    }

    // TAB 1: EXPLAINABLE AI (SHAP)
    const localForm = document.getElementById("local-explain-form");
    localForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const formData = new FormData(localForm);
        const data = {};
        formData.forEach((value, key) => {
            // Replace underscores with spaces for backend expectations if needed
            data[key.replace("_", " ")] = parseFloat(value);
        });

        fetch("/explain/local", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        })
        .then(res => res.json())
        .then(res => {
            if (res.error) {
                alert(`Error: ${res.error}`);
                return;
            }
            renderLocalExplanation(res);
        })
        .catch(err => console.error("Error explaining local instance:", err));
    });

    function renderLocalExplanation(res) {
        const summary = document.getElementById("local-explain-summary");
        summary.innerHTML = `
            <strong>Prediction Result:</strong> Quality Score: <b>${res.prediction.toFixed(2)}</b><br/>
            <strong>Base Value (Average model prediction):</strong> ${res.base_value.toFixed(2)}<br/>
            ${res.fallback ? '<span style="color:var(--warning);">*Manually computed linear approximation fallback.</span>' : ''}
        `;

        // Sort contributions to plot
        const contributions = res.contributions;
        const labels = contributions.map(c => c.feature);
        const shapValues = contributions.map(c => c.shap_value);
        const colorsList = shapValues.map(v => v >= 0 ? "rgba(239, 68, 68, 0.75)" : "rgba(59, 130, 246, 0.75)");

        if (localShapChart) localShapChart.destroy();

        const ctx = document.getElementById("localShapChart").getContext("2d");
        localShapChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: labels,
                datasets: [{
                    label: "SHAP Value (Prediction Influence)",
                    data: shapValues,
                    backgroundColor: colorsList,
                    borderColor: colorsList.map(c => c.replace("0.75", "1")),
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: "y",
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { color: "rgba(255, 255, 255, 0.05)" },
                        ticks: { color: "var(--text-secondary)" }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: "var(--text-secondary)" }
                    }
                }
            }
        });
    }

    function loadGlobalShap() {
        fetch("/explain/global")
            .then(res => res.json())
            .then(res => {
                if (res.error) return;
                
                const labels = res.importances.map(i => i.feature);
                const values = res.importances.map(i => i.importance);

                if (globalShapChart) globalShapChart.destroy();

                const ctx = document.getElementById("globalImportanceChart").getContext("2d");
                globalShapChart = new Chart(ctx, {
                    type: "bar",
                    data: {
                        labels: labels,
                        datasets: [{
                            data: values,
                            backgroundColor: "rgba(177, 51, 255, 0.6)",
                            borderColor: "rgba(177, 51, 255, 1)",
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            y: {
                                grid: { color: "rgba(255, 255, 255, 0.05)" },
                                ticks: { color: "var(--text-secondary)" }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { color: "var(--text-secondary)" }
                            }
                        }
                    }
                });
            })
            .catch(err => console.error("Error loading global SHAP:", err));
    }

    // TAB 2: MONITORING
    function loadMonitoringData() {
        fetch("/monitoring/drift")
            .then(res => res.json())
            .then(res => {
                const countElem = document.getElementById("monitor-count");
                const statusElem = document.getElementById("monitor-drift-status");
                const percentElem = document.getElementById("monitor-drift-percent");
                const banner = document.getElementById("drift-alert");

                if (res.status === "insufficient_data") {
                    countElem.textContent = res.prediction_count;
                    statusElem.textContent = "Insufficient Logs";
                    percentElem.textContent = res.message;
                    banner.style.display = "none";
                    return;
                }

                if (res.status === "error") {
                    statusElem.textContent = "Error";
                    percentElem.textContent = res.message;
                    return;
                }

                countElem.textContent = res.total_predictions;
                statusElem.textContent = res.drift_detected ? "Drift Detected" : "Stable";
                statusElem.style.color = res.drift_detected ? "var(--warning)" : "var(--success)";
                percentElem.textContent = `${Math.round(res.drifted_features_ratio * 100)}% features drifted`;

                if (res.drift_detected) {
                    banner.style.display = "block";
                } else {
                    banner.style.display = "none";
                }

                // Render metrics table
                const tbody = document.querySelector("#drift-table tbody");
                tbody.innerHTML = "";

                Object.keys(res.metrics).forEach(feature => {
                    const m = res.metrics[feature];
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td><b>${feature}</b></td>
                        <td>${m.ref_mean.toFixed(4)}</td>
                        <td>${m.pred_mean.toFixed(4)}</td>
                        <td>${m.ks_statistic.toFixed(4)}</td>
                        <td>${m.p_value.toFixed(4)}</td>
                        <td>
                            <span class="drift-badge ${m.drift_detected ? 'drifted' : 'stable'}">
                                ${m.drift_detected ? 'Drifted' : 'Stable'}
                            </span>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            })
            .catch(err => console.error("Error loading monitoring logs:", err));
    }

    // TAB 3: EXPERIMENTS (MLFLOW)
    function loadExperimentsData() {
        fetch("/experiments/runs")
            .then(res => res.json())
            .then(res => {
                const tbody = document.querySelector("#experiments-table tbody");
                tbody.innerHTML = "";

                if (res.runs.length === 0) {
                    tbody.innerHTML = "<tr><td colspan='7' style='text-align:center;'>No experiments logged in MLflow tracking server yet.</td></tr>";
                    return;
                }

                res.runs.forEach(run => {
                    const tr = document.createElement("tr");
                    const r2 = run.metrics.r2 !== undefined ? run.metrics.r2.toFixed(4) : "N/A";
                    const rmse = run.metrics.rmse !== undefined ? run.metrics.rmse.toFixed(4) : "N/A";
                    
                    // Format params string
                    let paramsStr = "";
                    Object.keys(run.params).forEach(k => {
                        paramsStr += `${k}=${run.params[k]}, `;
                    });
                    paramsStr = paramsStr.slice(0, -2) || "None";

                    tr.innerHTML = `
                        <td><code style="font-family: 'Space Mono'; font-size:11px;">${run.run_id.slice(0, 8)}</code></td>
                        <td><b>${run.run_name}</b></td>
                        <td>${run.start_time}</td>
                        <td><span style="color:var(--text-secondary); font-size:12px;">${paramsStr}</span></td>
                        <td><b>${r2}</b></td>
                        <td>${rmse}</td>
                        <td><span style="color:var(--success); font-weight:600;">${run.status}</span></td>
                    `;
                    tbody.appendChild(tr);
                });
            })
            .catch(err => console.error("Error fetching MLflow experiments:", err));
    }

    // TAB 4: BENCHMARKS
    function loadBenchmarksData() {
        fetch("/benchmarking/results")
            .then(res => res.json())
            .then(res => {
                const labels = Object.keys(res);
                const r2Scores = labels.map(k => res[k].r2);
                const rmseScores = labels.map(k => res[k].rmse);

                if (benchmarkChart) benchmarkChart.destroy();

                const ctx = document.getElementById("benchmarkChart").getContext("2d");
                benchmarkChart = new Chart(ctx, {
                    type: "bar",
                    data: {
                        labels: labels,
                        datasets: [
                            {
                                label: "R2 Score",
                                data: r2Scores,
                                backgroundColor: "rgba(51, 204, 255, 0.6)",
                                borderColor: "rgba(51, 204, 255, 1)",
                                borderWidth: 1
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false }
                        },
                        scales: {
                            y: {
                                grid: { color: "rgba(255, 255, 255, 0.05)" },
                                ticks: { color: "var(--text-secondary)" }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { color: "var(--text-secondary)" }
                            }
                        }
                    }
                });

                // Populate Benchmark Ranking Table
                const tbody = document.querySelector("#benchmark-table tbody");
                tbody.innerHTML = "";

                // Sort models by R2 descending
                const sorted = Object.keys(res)
                    .map(name => ({ name, ...res[name] }))
                    .sort((a, b) => b.r2 - a.r2);

                sorted.forEach((model, index) => {
                    const tr = document.createElement("tr");
                    tr.innerHTML = `
                        <td><b>${model.name}</b></td>
                        <td><b>${model.r2.toFixed(4)}</b></td>
                        <td>${model.rmse.toFixed(4)}</td>
                        <td>${model.mae.toFixed(4)}</td>
                        <td><span style="font-weight:700; color:${index === 0 ? 'var(--success)' : 'var(--text-secondary)'}">#${index + 1}</span></td>
                    `;
                    tbody.appendChild(tr);
                });
            })
            .catch(err => console.error("Error loading benchmarks:", err));
    }

    // TAB 5: ENTERPRISE ANALYTICS & TRENDS
    function loadAnalyticsData() {
        fetch("/analytics/summary")
            .then(res => res.json())
            .then(res => {
                if (res.prediction_count === 0) {
                    return;
                }
                const trends = res.daily_trends;
                const labels = trends.map(t => t.date);
                const counts = trends.map(t => t.count);

                if (trendsChart) trendsChart.destroy();

                const ctx = document.getElementById("trendsChart").getContext("2d");
                trendsChart = new Chart(ctx, {
                    type: "line",
                    data: {
                        labels: labels,
                        datasets: [{
                            label: "Daily Prediction Volume",
                            data: counts,
                            backgroundColor: "rgba(255, 51, 102, 0.2)",
                            borderColor: "rgba(255, 51, 102, 1)",
                            borderWidth: 2,
                            fill: true,
                            tension: 0.3
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                grid: { color: "rgba(255, 255, 255, 0.05)" },
                                ticks: { color: "var(--text-secondary)" }
                            },
                            x: {
                                grid: { display: false },
                                ticks: { color: "var(--text-secondary)" }
                            }
                        }
                    }
                });
            })
            .catch(err => console.error("Error loading analytics summary:", err));
    }
});
