// Constants
const COMPARISON_STATES = {
    BETTER: 1,
    WORSE: 0,
    NOT_COMPARED: -1,
};

// Global state
let appState = {
    items: [],
    comparisonGraph: {},
    questionHistory: [],
    currentQuestionIndex: 0,
    currentQuestion: null,
    finalRanking: [],
    selectedItems: [],
    tiers: null,
    tierItemMap: {} // Maps item -> tier number for quick lookup
};

// Tier parsing functionality
function parseTiers(inputText, tierParsingEnabled) {
    if (!tierParsingEnabled) {
        return {
            items: inputText
                .split('\n')
                .map(item => item.trim())
                .filter(item => item.length > 0),
            tiers: null
        };
    }
    
    const lines = inputText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const tiers = {};
    const items = [];
    
    // Regex patterns to match various tier formats
    const tierPatterns = [
        /^(\d+)\.\s*(.+)$/,      // 1. item
        /^(\d+)\)\s*(.+)$/,      // 1) item  
        /^(\d+)\.\)\s*(.+)$/,    // 1.) item
        /^(\d+)\/\s*(.+)$/,      // 1/ item
        /^(\d+)\s+(.+)$/,        // 1 item
        /^\((\d+)\)\s*(.+)$/     // (1) item
    ];
    
    lines.forEach(line => {
        let matched = false;
        
        for (const pattern of tierPatterns) {
            const match = line.match(pattern);
            if (match) {
                const tierNumber = parseInt(match[1], 10);
                const itemName = match[2].trim();
                
                if (!tiers[tierNumber]) {
                    tiers[tierNumber] = [];
                }
                tiers[tierNumber].push(itemName);
                items.push(itemName);
                matched = true;
                break;
            }
        }
        
        // If no tier pattern matched, treat as regular item
        if (!matched) {
            items.push(line);
        }
    });
    
    // Only return tier data if we found actual tiers
    const tierNumbers = Object.keys(tiers).map(n => parseInt(n, 10));
    const hasTiers = tierNumbers.length > 0;
    
    return {
        items,
        tiers: hasTiers ? tiers : null
    };
}

// Core ranking algorithms
function generateEmptyGraph(items) {
    const graph = {};
    items.forEach(item1 => {
        graph[item1] = {};
        items.forEach(item2 => {
            graph[item1][item2] = COMPARISON_STATES.NOT_COMPARED;
        });
    });
    return graph;
}

function generateTierGraph(items, tiers) {
    let graph = generateEmptyGraph(items);
    
    if (!tiers) return graph;
    
    // Get sorted tier numbers
    const tierNumbers = Object.keys(tiers).map(n => parseInt(n, 10)).sort((a, b) => a - b);
    
    // For each tier, make all items in lower-numbered tiers better than all items in higher-numbered tiers
    for (let i = 0; i < tierNumbers.length; i++) {
        for (let j = i + 1; j < tierNumbers.length; j++) {
            const higherTier = tiers[tierNumbers[i]];
            const lowerTier = tiers[tierNumbers[j]];
            
            // Every item in higher tier beats every item in lower tier
            higherTier.forEach(higherItem => {
                lowerTier.forEach(lowerItem => {
                    graph = updateComparisonGraph(graph, higherItem, lowerItem);
                });
            });
        }
    }
    
    return graph;
}

function canCompare(a, b, comparisonGraph) {
    return comparisonGraph[a][b] !== COMPARISON_STATES.NOT_COMPARED;
}

function isBetterThan(a, b, comparisonGraph) {
    return comparisonGraph[a][b] === COMPARISON_STATES.BETTER;
}

function iterativeMergeSort(arr, comparisonGraph) {
    let sorted = arr.slice();
    let n = sorted.length;
    let buffer = new Array(n);

    for (let size = 1; size < n; size *= 2) {
        for (let leftStart = 0; leftStart < n; leftStart += 2 * size) {
            let left = leftStart;
            let right = Math.min(left + size, n);
            let leftLimit = right;
            let rightLimit = Math.min(right + size, n);
            let i = left;

            while (left < leftLimit && right < rightLimit) {
                if (canCompare(sorted[left], sorted[right], comparisonGraph)) {
                    if (isBetterThan(sorted[left], sorted[right], comparisonGraph)) {
                        buffer[i++] = sorted[left++];
                    } else {
                        buffer[i++] = sorted[right++];
                    }
                } else {
                    return {
                        array: sorted,
                        nextQuestion: [sorted[left], sorted[right]]
                    };
                }
            }

            while (left < leftLimit) {
                buffer[i++] = sorted[left++];
            }

            while (right < rightLimit) {
                buffer[i++] = sorted[right++];
            }
        }

        let temp = sorted;
        sorted = buffer;
        buffer = temp;
    }
    
    return {
        array: sorted,
        nextQuestion: null
    };
}

function getNextQuestion(items, comparisonGraph) {
    return iterativeMergeSort(items, comparisonGraph);
}

function updateComparisonGraph(graph, better, worse) {
    return {
        ...graph,
        [better]: {
            ...graph[better],
            [worse]: COMPARISON_STATES.BETTER
        },
        [worse]: {
            ...graph[worse],
            [better]: COMPARISON_STATES.WORSE
        }
    };
}

function estimateQuestionsRemaining(items) {
    const n = items.length;
    if (n <= 1) return 0;
    const log = Math.ceil(Math.log2(n));
    return n * log - 2 ** log + 1;
}

// Justification algorithms
function shortestPath(graph, source, target) {
    let visited = {};
    for (const item in graph) {
        visited[item] = false;
    }
    visited[source] = true;

    let parent = {
        [source]: null
    };

    let queue = [source];
    
    // Generate shortest path from source to everywhere else
    while (queue.length > 0) {
        const current = queue.shift();

        // Gather children - items that current is better than
        let itemsCurrentIsBetterThan = [];
        for (const item in graph[current]) {
            if (!visited[item] && isBetterThan(current, item, graph)) {
                itemsCurrentIsBetterThan.push(item);
            }
        }

        itemsCurrentIsBetterThan.forEach(item => {
            parent[item] = current;
            visited[item] = true;
            queue.push(item);
        });
    }

    // Find path from source to target
    let path = [];
    let current = target;

    while (current != null) {
        path.push(current);
        current = parent[current];
    }
    path.reverse();

    return path;
}

function getQuestionNumber(questionsAsked, a, b) {
    let questionIndex = -1;
    questionsAsked.forEach((question, index) => {
        if (
            (question[0] === a && question[1] === b) ||
            (question[0] === b && question[1] === a)
        ) {
            questionIndex = index;
        }
    });

    if (questionIndex === -1) {
        return -1;
    }

    return questionIndex + 1;
}

function isTierComparison(item1, item2) {
    if (!appState.tiers || !appState.tierItemMap[item1] || !appState.tierItemMap[item2]) {
        return false;
    }
    return appState.tierItemMap[item1] !== appState.tierItemMap[item2];
}

function getJustificationPath(selections, finalRanking, comparisonGraph, questionHistory) {
    if (selections.length !== 2) return null;
    
    // Sort selections by their ranking position
    const sortedSelections = [...selections].sort((a, b) => 
        finalRanking.indexOf(a) - finalRanking.indexOf(b)
    );
    
    // Check if this is a direct tier comparison
    if (isTierComparison(sortedSelections[0], sortedSelections[1])) {
        const higherItem = sortedSelections[0];
        const lowerItem = sortedSelections[1];
        const higherTier = appState.tierItemMap[higherItem];
        const lowerTier = appState.tierItemMap[lowerItem];
        
        return [{
            better: higherItem,
            worse: lowerItem,
            tierComparison: true,
            higherTier: higherTier,
            lowerTier: lowerTier
        }];
    }
    
    const path = shortestPath(comparisonGraph, sortedSelections[0], sortedSelections[1]);
    
    if (path.length > 1) {
        let pathArray = [];
        for (let i = 0; i < path.length - 1; i++) {
            const current = path[i];
            const next = path[i + 1];
            
            // Check if this step is a tier comparison
            if (isTierComparison(current, next)) {
                const higherTier = appState.tierItemMap[current];
                const lowerTier = appState.tierItemMap[next];
                
                pathArray.push({
                    better: current,
                    worse: next,
                    tierComparison: true,
                    higherTier: higherTier,
                    lowerTier: lowerTier
                });
            } else {
                const questionNumber = getQuestionNumber(questionHistory, current, next);
                
                if (questionNumber !== -1) {
                    pathArray.push({
                        better: current,
                        worse: next,
                        questionNumber: questionNumber,
                        tierComparison: false
                    });
                }
            }
        }
        return pathArray;
    }
    
    return null;
}

// Page management
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

// Input page logic
function initializeInputPage() {
    const form = document.getElementById('input-form');
    const textarea = document.getElementById('items-input');
    const tierParsingCheckbox = document.getElementById('tier-parsing');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const inputText = textarea.value.trim();
        const tierParsingEnabled = tierParsingCheckbox.checked;
        
        const parsed = parseTiers(inputText, tierParsingEnabled);
        
        if (parsed.items.length < 2) {
            alert('Please enter at least 2 items to rank');
            return;
        }
        
        startRanking(parsed.items, parsed.tiers);
    });
}

// Ranking page logic
function startRanking(items, tiers = null) {
    appState.items = items;
    appState.tiers = tiers;
    appState.tierItemMap = {};
    appState.comparisonGraph = tiers ? generateTierGraph(items, tiers) : generateEmptyGraph(items);
    appState.questionHistory = [];
    appState.currentQuestionIndex = 0;
    
    // Build tier item map for quick lookup
    if (tiers) {
        Object.keys(tiers).forEach(tierNumber => {
            const tierNum = parseInt(tierNumber, 10);
            tiers[tierNumber].forEach(item => {
                appState.tierItemMap[item] = tierNum;
            });
        });
        
        const tierNumbers = Object.keys(tiers).map(n => parseInt(n, 10)).sort((a, b) => a - b);
        
        for (let i = 0; i < tierNumbers.length; i++) {
            for (let j = i + 1; j < tierNumbers.length; j++) {
                const higherTier = tiers[tierNumbers[i]];
                const lowerTier = tiers[tierNumbers[j]];
                
                // Add all tier comparisons to history
                higherTier.forEach(higherItem => {
                    lowerTier.forEach(lowerItem => {
                        appState.questionHistory.push([higherItem, lowerItem]);
                    });
                });
            }
        }
        
        appState.currentQuestionIndex = appState.questionHistory.length;
    }
    
    showPage('ranking-page');
    updateRankingPage();
}

function updateRankingPage() {
    const result = getNextQuestion(appState.items, appState.comparisonGraph);
    
    if (result.nextQuestion) {
        appState.currentQuestion = result.nextQuestion;
        displayQuestion(result.nextQuestion);
        updateProgress();
    } else {
        // Ranking complete
        appState.finalRanking = result.array;
        showResults();
    }
}

function displayQuestion(question) {
    const choiceA = document.getElementById('choice-a');
    const choiceB = document.getElementById('choice-b');
    
    choiceA.textContent = question[0];
    choiceB.textContent = question[1];
    
    choiceA.onclick = () => handleChoice(question[0], question[1]);
    choiceB.onclick = () => handleChoice(question[1], question[0]);
}

function handleChoice(better, worse) {
    appState.comparisonGraph = updateComparisonGraph(appState.comparisonGraph, better, worse);
    
    // Update history
    const newHistory = [...appState.questionHistory.slice(0, appState.currentQuestionIndex), [better, worse]];
    appState.questionHistory = newHistory;
    appState.currentQuestionIndex = newHistory.length;
    
    updateRankingPage();
}

function updateProgress() {
    const progress = document.getElementById('progress');
    const backBtn = document.getElementById('back-btn');
    const forwardBtn = document.getElementById('forward-btn');
    
    const totalQuestions = estimateQuestionsRemaining(appState.items);
    const questionsAsked = appState.currentQuestionIndex;
    
    progress.textContent = `Question ${questionsAsked + 1} of up to ${totalQuestions}`;
    
    // Update button states
    backBtn.disabled = false; // Always allow going back
    forwardBtn.disabled = appState.currentQuestionIndex >= appState.questionHistory.length;
}

function initializeRankingPage() {
    const backBtn = document.getElementById('back-btn');
    const forwardBtn = document.getElementById('forward-btn');
    
    backBtn.addEventListener('click', () => {
        if (appState.currentQuestionIndex > 0) {
            // Revert to previous state
            const newIndex = appState.currentQuestionIndex - 1;
            appState.currentQuestionIndex = newIndex;
            
            // Rebuild graph from history up to newIndex
            let newGraph = generateEmptyGraph(appState.items);
            for (let i = 0; i < newIndex; i++) {
                const [better, worse] = appState.questionHistory[i];
                newGraph = updateComparisonGraph(newGraph, better, worse);
            }
            appState.comparisonGraph = newGraph;
            updateRankingPage();
        } else {
            showPage('input-page');
        }
    });
    
    forwardBtn.addEventListener('click', () => {
        if (appState.currentQuestionIndex < appState.questionHistory.length) {
            const [better, worse] = appState.questionHistory[appState.currentQuestionIndex];
            handleChoice(better, worse);
        }
    });
}

// Results page logic
function showResults() {
    const rankingList = document.getElementById('ranking-list');
    rankingList.innerHTML = '';
    
    // Reset selection state
    appState.selectedItems = [];
    
    appState.finalRanking.forEach((item, index) => {
        const rankingItem = document.createElement('div');
        rankingItem.className = 'ranking-item';
        rankingItem.dataset.item = item;
        
        rankingItem.innerHTML = `
            <div class="rank-number">#${index + 1}</div>
            <div class="item-name">${escapeHtml(item)}</div>
        `;
        
        // Add click handler for item selection
        rankingItem.addEventListener('click', () => handleItemSelection(item, rankingItem));
        
        rankingList.appendChild(rankingItem);
    });
    
    // Clear any existing justification display
    updateJustificationDisplay();
    
    showPage('results-page');
}

function handleItemSelection(item, element) {
    const selectedIndex = appState.selectedItems.indexOf(item);
    
    if (selectedIndex === -1) {
        // Item not selected, add it
        if (appState.selectedItems.length >= 2) {
            // Remove oldest selection if we already have 2
            const oldestItem = appState.selectedItems.shift();
            const oldestElement = document.querySelector(`[data-item="${oldestItem}"]`);
            if (oldestElement) {
                oldestElement.classList.remove('selected');
            }
        }
        appState.selectedItems.push(item);
        element.classList.add('selected');
    } else {
        // Item already selected, remove it
        appState.selectedItems.splice(selectedIndex, 1);
        element.classList.remove('selected');
    }
    
    updateJustificationDisplay();
}

function updateJustificationDisplay() {
    let justificationArea = document.getElementById('justification-area');
    
    // Create justification area if it doesn't exist
    if (!justificationArea) {
        justificationArea = document.createElement('div');
        justificationArea.id = 'justification-area';
        justificationArea.className = 'justification-area';
        
        const resultsPage = document.getElementById('results-page');
        const pageContent = resultsPage.querySelector('.page-content');
        const resultsActions = document.querySelector('.results-actions');
        
        pageContent.insertBefore(justificationArea, resultsActions);
    }
    
    if (appState.selectedItems.length === 0) {
        justificationArea.innerHTML = `
            <div class="justification-prompt">
                Click any pair of items to learn why one ranks higher than the other
            </div>
        `;
    } else if (appState.selectedItems.length === 1) {
        justificationArea.innerHTML = `
            <div class="justification-prompt">
                Select another item to see the comparison
            </div>
        `;
    } else if (appState.selectedItems.length === 2) {
        const path = getJustificationPath(
            appState.selectedItems, 
            appState.finalRanking, 
            appState.comparisonGraph, 
            appState.questionHistory
        );
        
        if (path && path.length > 0) {
            let pathHtml = '';
            path.forEach(step => {
                if (step.tierComparison) {
                    pathHtml += `
                        <div class="justification-step tier-step">
                            <strong>${escapeHtml(step.better)}</strong> is in tier ${step.higherTier} while <strong>${escapeHtml(step.worse)}</strong> is in tier ${step.lowerTier}
                        </div>
                    `;
                } else {
                    pathHtml += `
                        <div class="justification-step question-step">
                            (Q${step.questionNumber}) You said <strong>${escapeHtml(step.better)}</strong> is better than <strong>${escapeHtml(step.worse)}</strong>
                        </div>
                    `;
                }
            });
            
            // Sort selected items by ranking order for display
            const sortedForDisplay = [...appState.selectedItems].sort((a, b) => 
                appState.finalRanking.indexOf(a) - appState.finalRanking.indexOf(b)
            );
            
            justificationArea.innerHTML = `
                <div class="justification-header">Why "${escapeHtml(sortedForDisplay[0])}" ranks higher than "${escapeHtml(sortedForDisplay[1])}":</div>
                ${pathHtml}
            `;
        } else {
            justificationArea.innerHTML = `
                <div class="justification-error">
                    No direct comparison path found between these items.
                </div>
            `;
        }
    }
}

function initializeResultsPage() {
    const newRankingBtn = document.getElementById('new-ranking-btn');
    const shareBtn = document.getElementById('share-btn');
    
    newRankingBtn.addEventListener('click', () => {
        // Reset state
        appState = {
            items: [],
            comparisonGraph: {},
            questionHistory: [],
            currentQuestionIndex: 0,
            currentQuestion: null,
            finalRanking: [],
            selectedItems: [],
            tiers: null,
            tierItemMap: {}
        };
        
        // Clear input
        document.getElementById('items-input').value = '';
        
        showPage('input-page');
    });
    
    shareBtn.addEventListener('click', shareRanking);
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Share ranking functionality - Ultra compressed encoding
function encodeString(data) {
    const items = data.items;
    const history = data.questionHistory;
    const tiers = data.tiers;
    
    // Use item indices instead of full strings (massive space saving)
    const itemMap = {};
    items.forEach((item, index) => itemMap[item] = index);
    
    // Encode history as pairs of indices instead of full strings
    const compressedHistory = history.map(([better, worse]) => [
        itemMap[better], 
        itemMap[worse]
    ]);
    
    // Encode tiers using indices if present
    let compressedTiers = null;
    if (tiers) {
        compressedTiers = {};
        Object.keys(tiers).forEach(tierNumber => {
            compressedTiers[tierNumber] = tiers[tierNumber].map(item => itemMap[item]);
        });
    }
    
    // Create ultra-minimal structure: items, compressed history, and tiers
    const compressed = [
        items,
        compressedHistory,
        compressedTiers
    ];
    
    // Use shorter JSON with minimal whitespace, then base64
    const jsonString = JSON.stringify(compressed).replace(/\s/g, '');
    return btoa(unescape(encodeURIComponent(jsonString)))
        .replace(/\+/g, '-')  // URL-safe base64
        .replace(/\//g, '_')
        .replace(/=/g, '');   // Remove padding
}

function decodeString(encodedData) {
    try {
        // Restore URL-safe base64 and add padding if needed
        let base64 = encodedData
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        
        // Add padding
        while (base64.length % 4) {
            base64 += '=';
        }
        
        const jsonString = decodeURIComponent(escape(atob(base64)));
        const [items, compressedHistory, compressedTiers] = JSON.parse(jsonString);
        
        // Reconstruct full history from indices
        const history = compressedHistory.map(([betterIdx, worseIdx]) => [
            items[betterIdx],
            items[worseIdx]
        ]);
        
        // Reconstruct tiers from indices if present
        let tiers = null;
        if (compressedTiers) {
            tiers = {};
            Object.keys(compressedTiers).forEach(tierNumber => {
                tiers[tierNumber] = compressedTiers[tierNumber].map(itemIdx => items[itemIdx]);
            });
        }
        
        // Reconstruct ranking by replaying the history
        let comparisonGraph = tiers ? generateTierGraph(items, tiers) : generateEmptyGraph(items);
        history.forEach(([better, worse]) => {
            comparisonGraph = updateComparisonGraph(comparisonGraph, better, worse);
        });
        
        const result = getNextQuestion(items, comparisonGraph);
        const ranking = result.array;
        
        return {
            items,
            history,
            ranking,
            tiers
        };
    } catch (error) {
        console.error('Failed to decode share data:', error);
        return null;
    }
}

function generateShareUrl(data) {
    const encoded = encodeString(data);
    return `${window.location.origin}${window.location.pathname}#${encoded}`;
}

function shareRanking() {
    const shareBtn = document.getElementById('share-btn');
    
    // Disable button and show checkmark
    shareBtn.disabled = true;
    shareBtn.classList.add('success');
    
    const shareData = {
        items: appState.items,
        questionHistory: appState.questionHistory,
        finalRanking: appState.finalRanking,
        tiers: appState.tiers
    };
    
    const shareUrl = generateShareUrl(shareData);
    
    // Copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => {
            // Success handled by the visual feedback
        }).catch(() => {
            fallbackCopyToClipboard(shareUrl);
        });
    } else {
        fallbackCopyToClipboard(shareUrl);
    }
    
    // Re-enable button and hide checkmark after 3 seconds
    setTimeout(() => {
        shareBtn.disabled = false;
        shareBtn.classList.remove('success');
    }, 3000);
}

function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        document.execCommand('copy');
        // Success is already handled by the visual feedback in shareRanking()
    } catch (err) {
        // On error, show an alert since the visual feedback won't be meaningful
        alert('Failed to copy link. Please copy manually: ' + text);
    }
    
    document.body.removeChild(textArea);
}


function loadSharedRanking() {
    const hash = window.location.hash.slice(1); // Remove #
    if (!hash) return false;
    
    const decodedData = decodeString(hash);
    if (!decodedData || !decodedData.items || !decodedData.history || !decodedData.ranking) {
        console.error('Invalid share data');
        return false;
    }
    
    // Restore the app state
    appState.items = decodedData.items;
    appState.questionHistory = decodedData.history;
    appState.finalRanking = decodedData.ranking;
    appState.currentQuestionIndex = decodedData.history.length;
    appState.selectedItems = [];
    appState.tiers = decodedData.tiers;
    appState.tierItemMap = {};
    
    // Build tier item map if tiers exist
    if (decodedData.tiers) {
        Object.keys(decodedData.tiers).forEach(tierNumber => {
            const tierNum = parseInt(tierNumber, 10);
            decodedData.tiers[tierNumber].forEach(item => {
                appState.tierItemMap[item] = tierNum;
            });
        });
    }
    
    // Rebuild comparison graph from history
    appState.comparisonGraph = decodedData.tiers ? 
        generateTierGraph(decodedData.items, decodedData.tiers) : 
        generateEmptyGraph(decodedData.items);
    decodedData.history.forEach(([better, worse]) => {
        appState.comparisonGraph = updateComparisonGraph(appState.comparisonGraph, better, worse);
    });
    
    // Show results directly
    showResults();
    return true;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    initializeInputPage();
    initializeRankingPage();
    initializeResultsPage();
    
    // Check if there's a shared ranking in the URL
    if (!loadSharedRanking()) {
        // No shared ranking, start with input page
        showPage('input-page');
    }
});
