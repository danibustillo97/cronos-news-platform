
// Simple but effective stopword list for Spanish and English
const STOP_WORDS = new Set([
    // Spanish
    "de", "la", "que", "el", "en", "y", "a", "los", "se", "del", "las", "un", "por", "con", "no", "una", "su", "para", "es", "al", "lo", "como", "mas", "o", "pero", "sus", "le", "ha", "me", "si", "sin", "sobre", "este", "ya", "entre", "cuando", "todo", "esta", "ser", "son", "dos", "tambien", "fue", "habia", "era", "muy", "anos", "hasta", "desde", "esta", "mi", "porque", "que", "solo", "han", "yo", "hay", "vez", "puede", "todos", "asi", "nos", "ni", "parte", "tiene", "uno", "donde", "bien", "tiempo", "mismo", "ese", "ahora", "cada", "e", "vida", "otro", "despues", "te", "otros", "aunque", "esa", "eso", "hace", "otra", "gobierno", "tan", "durante", "siempre", "dia", "tanto", "ella", "tres", "si", "dijo", "sido", "gran", "pais", "segun", "menos", "mundo", "ano", "antes", "estado", "contra", "sino", "forma", "caso", "nada", "hacer", "general", "estaba", "poco", "estos", "mayor",
    // English
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "i", "it", "for", "not", "on", "with", "he", "as", "you", "do", "at", "this", "but", "his", "by", "from", "they", "we", "say", "her", "she", "or", "an", "will", "my", "one", "all", "would", "there", "their", "what", "so", "up", "out", "if", "about", "who", "get", "which", "go", "me", "when", "make", "can", "like", "time", "no", "just", "him", "know", "take", "people", "into", "year", "your", "good", "some", "could", "them", "see", "other", "than", "then", "now", "look", "only", "come", "its", "over", "think", "also", "back", "after", "use", "two", "how", "our", "work", "first", "well", "way", "even", "new", "want", "because", "any", "these", "give", "day", "most", "us"
]);

export function generateSmartTags(title: string, content: string, existingTags: string[] = []): string[] {
    const text = `${title} ${content}`.toLowerCase();
    
    // Remove HTML tags from content if present
    const cleanText = text.replace(/<[^>]*>/g, ' ');
    
    // Remove punctuation and special chars
    const words = cleanText.replace(/[^\w\sñáéíóúü]/g, '').split(/\s+/);
    
    const wordCounts: Record<string, number> = {};
    
    words.forEach(word => {
        if (word.length > 3 && !STOP_WORDS.has(word)) {
            wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
    });

    // Weight title words higher
    const titleWords = title.toLowerCase().replace(/[^\w\sñáéíóúü]/g, '').split(/\s+/);
    titleWords.forEach(word => {
        if (word.length > 3 && !STOP_WORDS.has(word)) {
            wordCounts[word] = (wordCounts[word] || 0) + 3; // Bonus for title presence
        }
    });

    // Sort by frequency
    const sortedWords = Object.entries(wordCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([word]) => word);

    // Take top 8 candidates
    const candidates = sortedWords.slice(0, 8);
    
    // Merge with existing tags, avoiding duplicates
    const result = new Set([...existingTags, ...candidates]);
    
    return Array.from(result).slice(0, 10); // Limit to 10 tags total
}

export function extractEntities(text: string): string[] {
    // Very basic heuristic for capitalized phrases (Proper Nouns)
    // This is a poor man's NER (Named Entity Recognition)
    const matches = text.match(/([A-ZÁÉÍÓÚÑ][a-zñáéíóúü]+(?:\s[A-ZÁÉÍÓÚÑ][a-zñáéíóúü]+)*)/g);
    if (!matches) return [];
    
    const entities: Record<string, number> = {};
    matches.forEach(m => {
        if (m.length > 3 && !STOP_WORDS.has(m.toLowerCase())) {
            entities[m] = (entities[m] || 0) + 1;
        }
    });

    return Object.entries(entities)
        .sort(([, a], [, b]) => b - a)
        .map(([entity]) => entity)
        .slice(0, 5);
}
