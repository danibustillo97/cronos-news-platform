export function stripHtml(html: string): string {
    if (!html) return "";
    
    // 1. Replace <br> variants with newlines
    let text = html.replace(/<br\s*\/?>/gi, '\n');
    
    // 2. Replace block-level closing tags with newlines
    text = text.replace(/<\/(p|div|h[1-6]|li|ul|ol|tr|td)>/gi, '\n');
    
    // 3. Remove all remaining tags
    text = text.replace(/<[^>]+>/g, '');
    
    // 4. Decode common HTML entities
    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    // 5. Normalize whitespace
    // Replace multiple spaces/tabs with single space, but preserve newlines
    text = text.replace(/[ \t]+/g, ' ');
    
    // Collapse multiple newlines/spaces mixtures into max 2 newlines
    text = text.replace(/(\s*\n\s*)+/g, '\n\n');

    return text.trim();
}

export function truncateText(text: string, maxLength: number): string {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + "...";
}

export function formatArticleContent(content: string): string {
    if (!content) return "";

    // 1. Basic cleaning and normalization
    let text = stripHtml(content);
    
    // 2. Advanced Sentence Splitting
    // Split on period+space, but ignore common abbreviations (Mr., Dr., etc - though simple regex misses some, it's better than nothing)
    // We actually want to form Paragraphs.
    
    // Strategy:
    // - Split into rough chunks by newlines first
    // - If a chunk is huge, split it into sentences and re-group them into smaller paragraphs
    
    let rawParagraphs = text.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0);
    const finalParagraphs: string[] = [];
    
    for (const p of rawParagraphs) {
        if (p.length < 200) {
            finalParagraphs.push(p);
            continue;
        }

        // It's a long block. Let's try to split it into sentences.
        // This regex looks for: punctuation [.?!] + space + Uppercase Letter
        const sentences = p.split(/(?<=[.?!])\s+(?=[A-Z¡¿"'])/);
        
        let currentPara = "";
        
        // Group sentences into paragraphs.
        // User requested: "necesito que los puntos apartes tengan un salto de lineas"
        // So we will be very aggressive. Every sentence that ends with a period and is reasonably long (e.g. > 80 chars) 
        // OR if the accumulated paragraph is getting long, we break.
        for (const sentence of sentences) {
             const trimmed = sentence.trim();
             if (!trimmed) continue;

             // If this single sentence is long enough, make it a paragraph.
             // Or if adding it to currentPara makes it > 200 chars (shorter than before), break.
             if (currentPara.length + trimmed.length > 250 || (trimmed.length > 100 && currentPara.length > 0)) {
                 if (currentPara) finalParagraphs.push(currentPara);
                 currentPara = trimmed;
             } else {
                 currentPara = currentPara ? `${currentPara} ${trimmed}` : trimmed;
             }
        }
        if (currentPara) finalParagraphs.push(currentPara);
    }
    
    // 3. Wrap in HTML
    return finalParagraphs.map(p => {
        let s = p;
        if (s.length > 0) {
            s = s.charAt(0).toUpperCase() + s.slice(1);
        }
        return `<p>${s}</p>`;
    }).join('');
}

function buildShingles(text: string, size: number): Set<string> {
    const words = text.split(' ').filter(Boolean);
    const shingles = new Set<string>();
    if (words.length < size) return shingles;
    for (let i = 0; i <= words.length - size; i++) {
        shingles.add(words.slice(i, i + size).join(' '));
    }
    return shingles;
}

export function normalizeTextForSimilarity(text: string): string {
    return stripHtml(text)
        .toLowerCase()
        .replace(/https?:\/\/\S+/g, '')
        .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export function jaccardSimilarity(a: string, b: string, shingleSize = 3): number {
    const sa = buildShingles(normalizeTextForSimilarity(a), shingleSize);
    const sb = buildShingles(normalizeTextForSimilarity(b), shingleSize);
    if (sa.size === 0 || sb.size === 0) return 0;

    let intersection = 0;
    for (const x of sa) {
        if (sb.has(x)) intersection++;
    }

    const union = sa.size + sb.size - intersection;
    if (union === 0) return 0;
    return intersection / union;
}
