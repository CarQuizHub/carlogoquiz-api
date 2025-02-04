import os

# Define the path to the brands folder
brands_folder = "assets/brands"

# Comprehensive list of car brands (based on Car Logos & global manufacturers)
car_brands = [
    "Abadal", "Abarth", "Abbott-Detroit", "ABT", "AC", "Acura", "Aiways", "Aixam", "Alfa Romeo", "Alpina", "Alpine", 
    "Alta", "Alvis", "AMC", "Apollo", "Arash", "Arcfox", "Ariel", "ARO", "Arrival", "Arrinera", "Artega", "Ascari", 
    "Askam", "Aspark", "Aston Martin", "Atalanta", "Auburn", "Audi", "Audi Sport", "Austin", "Autobacs", "Autobianchi", "Axon",
    "BAC", "BAIC Motor", "Baojun", "BeiBen", "Bentley", "Berkeley", "Berliet", "Bertone", "Bestune", "BharatBenz", 
    "Bitter", "Bizzarrini", "BMW", "BMW M", "Borgward", "Bowler", "Brabus", "Brammo", "Brilliance", "Bristol", "Brooke", 
    "Bufori", "Bugatti", "Buick", "BYD", "Byton",
    "Cadillac", "CAMC", "Canoo", "Caparo", "Carlsson", "Caterham", "Changan", "Changfeng", "Chery", "Chevrolet Corvette", 
    "Chevrolet", "Chrysler", "Cisitalia", "Citroën", "Cizeta", "Cole", "Corre La Licorne",
    "Dacia", "Daewoo", "DAF", "Daihatsu", "Daimler", "Dartz", "Datsun", "David Brown", "Dayun", "De Tomaso", "Delage", 
    "DeSoto", "Detroit Electric", "Devel Sixteen", "Diatto", "DINA", "DKW", "DMC", "Dodge", "Dodge Viper", "Dongfeng", 
    "Donkervoort", "Drako", "DS", "Duesenberg",
    "Eagle", "EDAG", "Edsel", "Eicher", "Elemental", "Elfin", "Elva", "Englon", "ERF", "Eterniti", "Exeed",
    "9ff", "Facel Vega", "Faraday Future", "FAW", "FAW Jiefang", "Ferrari", "Fiat", "Fioravanti", "Fisker", "Foden", 
    "Force Motors", "Ford", "Ford Mustang", "Foton", "FPV", "Franklin", "Freightliner", "FSO",
    "GAC Group", "Gardner Douglas", "GAZ", "Geely", "General Motors", "Genesis", "Geo", "Geometry", "Gilbern", "Gillet", 
    "Ginetta", "GMC", "Golden Dragon", "Gonow", "Great Wall", "Grinnall", "Gumpert",
    "Hafei", "Haima", "Haval", "Hawtai", "Hennessey", "Hillman", "Hindustan Motors", "Higer", "Hino", "HiPhi", 
    "Hispano-Suiza", "Holden", "Hommell", "Honda", "Hongqi", "Hongyan", "Horch", "HSV", "Hudson", "Hummer", "Hupmobile", "Hyundai",
    "IC Bus", "Infiniti", "Innocenti", "Intermeccanica", "IH", "International", "IKCO", "Irizar", "Isdera", "Iso", "Isuzu", "Iveco",
    "JAC", "Jaguar", "Jawa", "JBA Motors", "Jeep", "Jensen", "Jetta", "JMC",
    "Kaiser", "Kamaz", "Karlmann King", "Karma", "Keating", "Kenworth", "Kia", "King Long", "Koenigsegg", "KTM",
    "Lada", "Lagonda", "Lamborghini", "Lancia", "Land Rover", "Landwind", "Laraki", "Leapmotor", "Lexus", "Leyland", 
    "Li Auto", "Lifan", "Ligier", "Lincoln", "Lister", "Lloyd", "Lobini", "LEVC", "Lordstown", "Lotus", "Lucid", "Luxgen", "Lynk & Co",
    "Mack", "Mahindra", "MAN", "Mansory", "Marcos", "Marlin", "Maserati", "Mastretta", "Maxus", "Maybach", "MAZ", 
    "Mazda", "McLaren", "Melkus", "Mercedes-Benz", "Mercury", "Merkur", "MG", "Microcar", "MINI", "Mitsubishi", "Mitsuoka", "Morris", "Mosler", "Mullen", "Multicar",
    "Nash", "Navistar", "Neta", "NIO", "Nissan", "Noble",
    "Oltcit", "Opel", "ORA", "OSCA",
    "Pagani", "Panhard", "Panoz", "Perodua", "Peugeot", "PGO", "Pierce-Arrow", "Pininfarina", "Plymouth", "Polestar", 
    "Polski Fiat", "Pontiac", "Porsche", "Praga", "Premier", "Proton", "Puma",
    "Qoros",
    "RAM", "Rambler", "Ranz", "Reliant", "Renault", "Rezvani", "Rimac", "Rinspeed", "Rivian", "Roewe", "Rolls-Royce", "Ronart", "Rover", "Ruf",
    "Saab", "SAIC Motor", "Saleen", "Samsung", "Saturn", "Scania", "Scion", "SEAT", "Setra", "Shelby", "Simca", 
    "Singer", "Škoda", "Smart", "Soueast", "Spectre", "Spyker", "SsangYong", "SSC", "Studebaker", "Subaru", "Sunbeam", "Suzuki",
    "Tata", "Tatra", "Tesla", "Think", "Tiger", "Togg", "Tofas", "Toyota", "Tramontana", "Triumph", "TVR",
    "UAZ", "UD", "Ultima", "Unimog", "Ural", "Urus",
    "Vauxhall", "Vector", "Venturi", "Volkswagen", "Volvo", "Vuhl",
    "W Motors", "Wanderer", "Western Star", "Wiesmann", "Wuling",
    "Xpeng",
    "Yamaha", "Yulon",
    "Zagato", "ZAZ", "Zenvo", "Zhidou", "Zotye", "Zeekr", 
]
# Need to add LUCID, HUMMER, TVR, JEEP, ZEEKR, DMC to the accurate list when I sort out logo that are words

# Subfolders for each brand
subfolders = ["logo", "models", "audio"]

# Create the brand folders with subfolders
for brand in car_brands:
    brand_path = os.path.join(brands_folder, brand.lower().replace(" ", "_"))  # Normalize folder names
    os.makedirs(brand_path, exist_ok=True)
    
    for subfolder in subfolders:
        subfolder_path = os.path.join(brand_path, subfolder)
        os.makedirs(subfolder_path, exist_ok=True)

print(f"✅ Created brand folders with empty logo, model, and audio directories in {brands_folder}")
