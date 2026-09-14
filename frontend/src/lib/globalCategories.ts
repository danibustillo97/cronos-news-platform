
export const GLOBAL_CATEGORIES: Record<string, string[]> = {
    "Deportes": [
        "Fútbol", "Baloncesto", "Tenis", "Motor", "UFC/MMA", "Béisbol", "Fútbol Americano", "Ciclismo", "Atletismo", "Esports", "Golf", "Natación", "Voleibol", "Boxeo"
    ],
    "Tecnología": [
        "Inteligencia Artificial", "Gadgets", "Móviles", "Software", "Ciberseguridad", "Blockchain/Cripto", "Startups", "Redes Sociales", "Realidad Virtual", "Espacio"
    ],
    "Mundo": [
        "Política", "Conflictos", "Economía Global", "Medio Ambiente", "Sociedad", "Educación", "Salud", "Ciencia"
    ],
    "Entretenimiento": [
        "Cine", "Series/TV", "Música", "Celebridades", "Videojuegos", "Arte", "Libros", "Cultura Pop"
    ],
    "Negocios": [
        "Mercados", "Finanzas Personales", "Emprendimiento", "Empresas", "Inmobiliario", "Marketing", "E-commerce"
    ],
    "Estilo de Vida": [
        "Viajes", "Gastronomía", "Moda", "Fitness", "Bienestar", "Hogar", "Automóviles (Lifestyle)"
    ],
    "Opinión": [
        "Editoriales", "Columnas", "Análisis", "Entrevistas", "Reportajes"
    ]
};

export const FLATTENED_SUBCATEGORIES: Record<string, string[]> = {
    // Deportes (Detailed)
    "Fútbol": ["La Liga", "Premier League", "Champions League", "Serie A", "Bundesliga", "Ligue 1", "Copa del Mundo", "Libertadores", "Boca Juniors", "River Plate", "Real Madrid", "Barcelona", "Messi", "Cristiano Ronaldo", "Fichajes"],
    "Baloncesto": ["NBA", "Euroliga", "ACB", "LeBron James", "Curry", "Playoffs", "WNBA", "FIBA"],
    "Tenis": ["ATP", "WTA", "Grand Slam", "Wimbledon", "Roland Garros", "US Open", "Australian Open", "Copa Davis", "Nadal", "Djokovic", "Alcaraz"],
    "Motor": ["Fórmula 1", "MotoGP", "Rally", "Dakar", "IndyCar", "Fernando Alonso", "Verstappen", "Hamilton", "Marc Márquez"],
    "UFC/MMA": ["UFC", "Bellator", "PFL", "McGregor", "Topuria", "Título Mundial"],
    
    // Tecnología
    "Inteligencia Artificial": ["ChatGPT", "Gemini", "OpenAI", "Google", "Machine Learning", "Robótica", "Ética IA"],
    "Móviles": ["iPhone", "Samsung", "Android", "Xiaomi", "Apps", "Lanzamientos"],
    "Blockchain/Cripto": ["Bitcoin", "Ethereum", "NFTs", "DeFi", "Regulación"],
    
    // Entretenimiento
    "Cine": ["Estrenos", "Hollywood", "Premios Oscar", "Netflix", "Disney", "Marvel", "DC"],
    "Videojuegos": ["PlayStation", "Xbox", "Nintendo", "PC Gaming", "Lanzamientos", "Twitch", "Streamers"],
    
    // Mundo
    "Política": ["Elecciones", "Gobierno", "Leyes", "Diplomacia", "Crisis"],
    "Economía Global": ["Inflación", "Bolsa", "Dólar", "Euro", "Petróleo", "Bancos Centrales"]
};

export const getSubcategories = (category: string, subcategory?: string): string[] => {
    // 1. Try to find direct subcategories for the main category
    if (category && GLOBAL_CATEGORIES[category]) {
        // Since the structure in GLOBAL_CATEGORIES is Category -> Subcategory List
        // We might want to use that directly if it fits the new model, 
        // BUT the user wants "intelligent" subcategories. 
        // Let's check if we have specific detailed lists in FLATTENED_SUBCATEGORIES matches the category name
        // OR if the category matches a key in FLATTENED_SUBCATEGORIES (like "Fútbol")
        
        // Actually, the GLOBAL_CATEGORIES above are Category -> List of Subcategories.
        // The FLATTENED_SUBCATEGORIES are for when a user selects a SPECIFIC subcategory (e.g. Fútbol) 
        // and wants deeper topics, OR if we treat the "Subcategories" in GLOBAL as the main list.
        
        // Let's adjust the logic:
        // Level 1: Main Category (Deportes, Tecnología)
        // Level 2: Subcategory (Fútbol, IA)
        // Level 3: Topics (La Liga, ChatGPT) -> This is what we might want for "Tags" or refined selection.
        
        return GLOBAL_CATEGORIES[category] || [];
    }
    return [];
};

export const getTopicsForSubcategory = (subcategory: string): string[] => {
    return FLATTENED_SUBCATEGORIES[subcategory] || [];
};
