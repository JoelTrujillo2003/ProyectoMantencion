const supabaseUrl = 'https://jibqhrfgaujzpykkzkyd.supabase.co'; // <-- PON TU URL AQUÍ
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppYnFocmZnYXVqenB5a2t6a3lkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwNTUxNzIsImV4cCI6MjEwMzYzMTE3Mn0.enXGyNAC6wnUakCrLE0DHemANbngvD3yEngAfEmZSMs'; // <-- PON TU CLAVE AQUÍ

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
let currentUser = null;

// MEGA BASE DE DATOS PARA CHILE (Actualización Masiva de Modelos)
const vehicleDB = {
  "Auto": {
    "Chevrolet": { "Spark": {minYear: 2005, maxYear: 2026}, "Sail": {minYear: 2011, maxYear: 2026}, "Tracker": {minYear: 2013, maxYear: 2026}, "Onix": {minYear: 2016, maxYear: 2026}, "Colorado": {minYear: 2004, maxYear: 2026}, "Captiva": {minYear: 2006, maxYear: 2026}, "Silverado": {minYear: 1990, maxYear: 2026}, "Groove": {minYear: 2020, maxYear: 2026}, "Spin": {minYear: 2013, maxYear: 2026}, "Cavalier": {minYear: 1995, maxYear: 2021}, "Prisma": {minYear: 2013, maxYear: 2019}, "Cruze": {minYear: 2010, maxYear: 2023}, "Equinox": {minYear: 2008, maxYear: 2026}, "Traverse": {minYear: 2009, maxYear: 2026}, "Tahoe": {minYear: 1995, maxYear: 2026}, "Suburban": {minYear: 1990, maxYear: 2026}, "Montana": {minYear: 2004, maxYear: 2026}, "D-Max": {minYear: 2004, maxYear: 2022}, "N300": {minYear: 2012, maxYear: 2026}, "Orlando": {minYear: 2012, maxYear: 2018}, "Corsa": {minYear: 1994, maxYear: 2011}, "Optra": {minYear: 2004, maxYear: 2013}, "Aveo": {minYear: 2005, maxYear: 2014} },
    "Suzuki": { "Swift": {minYear: 2004, maxYear: 2026}, "Baleno": {minYear: 1995, maxYear: 2026}, "Jimny": {minYear: 1990, maxYear: 2026}, "Alto": {minYear: 2005, maxYear: 2026}, "S-Presso": {minYear: 2020, maxYear: 2026}, "Vitara": {minYear: 1990, maxYear: 2026}, "Ertiga": {minYear: 2012, maxYear: 2026}, "Celerio": {minYear: 2009, maxYear: 2026}, "Dzire": {minYear: 2012, maxYear: 2026}, "Ignis": {minYear: 2001, maxYear: 2026}, "Grand Nomade": {minYear: 1999, maxYear: 2019}, "Grand Vitara": {minYear: 1998, maxYear: 2026}, "APV": {minYear: 2005, maxYear: 2026}, "Ciaz": {minYear: 2015, maxYear: 2026}, "XL7": {minYear: 2002, maxYear: 2026}, "Fronx": {minYear: 2023, maxYear: 2026} },
    "Toyota": { "Yaris": {minYear: 1999, maxYear: 2026}, "Corolla": {minYear: 1990, maxYear: 2026}, "Hilux": {minYear: 1990, maxYear: 2026}, "RAV4": {minYear: 1994, maxYear: 2026}, "Rush": {minYear: 2018, maxYear: 2026}, "4Runner": {minYear: 1995, maxYear: 2026}, "Fortuner": {minYear: 2006, maxYear: 2026}, "Land Cruiser": {minYear: 1990, maxYear: 2026}, "Prado": {minYear: 1996, maxYear: 2026}, "Sequoia": {minYear: 2001, maxYear: 2026}, "Tacoma": {minYear: 1995, maxYear: 2026}, "Tundra": {minYear: 2000, maxYear: 2026}, "C-HR": {minYear: 2017, maxYear: 2026}, "Prius": {minYear: 2005, maxYear: 2026}, "Prius C": {minYear: 2012, maxYear: 2022}, "Camry": {minYear: 1990, maxYear: 2026}, "Agya": {minYear: 2023, maxYear: 2026}, "Raize": {minYear: 2021, maxYear: 2026}, "Avanza": {minYear: 2022, maxYear: 2026}, "Yaris Cross": {minYear: 2021, maxYear: 2026}, "Corolla Cross": {minYear: 2021, maxYear: 2026}, "Tercel": {minYear: 1990, maxYear: 2000} },
    "Nissan": { "Versa": {minYear: 2012, maxYear: 2026}, "Kicks": {minYear: 2016, maxYear: 2026}, "Navara": {minYear: 2005, maxYear: 2026}, "Qashqai": {minYear: 2007, maxYear: 2026}, "X-Trail": {minYear: 2001, maxYear: 2026}, "Sentra": {minYear: 1990, maxYear: 2026}, "Pathfinder": {minYear: 1990, maxYear: 2026}, "Patrol": {minYear: 1990, maxYear: 2026}, "March": {minYear: 2011, maxYear: 2023}, "Note": {minYear: 2014, maxYear: 2021}, "Murano": {minYear: 2003, maxYear: 2026}, "Tiida": {minYear: 2006, maxYear: 2018}, "Juke": {minYear: 2011, maxYear: 2026}, "NP300": {minYear: 2016, maxYear: 2026}, "Terrano": {minYear: 1990, maxYear: 2015}, "Leaf": {minYear: 2018, maxYear: 2026}, "V16": {minYear: 1990, maxYear: 2010}, "Almera": {minYear: 1996, maxYear: 2006} },
    "Honda": { "Civic": {minYear: 1990, maxYear: 2026}, "Accord": {minYear: 1990, maxYear: 2026}, "CR-V": {minYear: 1997, maxYear: 2026}, "HR-V": {minYear: 2015, maxYear: 2026}, "Pilot": {minYear: 2003, maxYear: 2026}, "Ridgeline": {minYear: 2006, maxYear: 2026}, "Fit": {minYear: 2004, maxYear: 2022}, "WR-V": {minYear: 2017, maxYear: 2026}, "City": {minYear: 2010, maxYear: 2026}, "Odyssey": {minYear: 1995, maxYear: 2026} },
    "Hyundai": { "Accent": {minYear: 1995, maxYear: 2026}, "Tucson": {minYear: 2004, maxYear: 2026}, "Santa Fe": {minYear: 2001, maxYear: 2026}, "Elantra": {minYear: 1990, maxYear: 2026}, "Grand i10": {minYear: 2013, maxYear: 2026}, "i10": {minYear: 2008, maxYear: 2019}, "i20": {minYear: 2021, maxYear: 2026}, "Creta": {minYear: 2016, maxYear: 2026}, "Venue": {minYear: 2020, maxYear: 2026}, "Palisade": {minYear: 2020, maxYear: 2026}, "H-1": {minYear: 1998, maxYear: 2023}, "Staria": {minYear: 2022, maxYear: 2026}, "Ioniq": {minYear: 2017, maxYear: 2026} },
    "Kia": { "Morning": {minYear: 2004, maxYear: 2026}, "Rio": {minYear: 2000, maxYear: 2026}, "Cerato": {minYear: 2004, maxYear: 2026}, "Sportage": {minYear: 1995, maxYear: 2026}, "Sorento": {minYear: 2002, maxYear: 2026}, "Soluto": {minYear: 2019, maxYear: 2026}, "Seltos": {minYear: 2020, maxYear: 2026}, "Sonet": {minYear: 2021, maxYear: 2026}, "Niro": {minYear: 2017, maxYear: 2026}, "Carens": {minYear: 2000, maxYear: 2026}, "Carnival": {minYear: 2000, maxYear: 2026}, "Frontier": {minYear: 1998, maxYear: 2026} },
    "Peugeot": { "208": {minYear: 2012, maxYear: 2026}, "308": {minYear: 2007, maxYear: 2026}, "2008": {minYear: 2013, maxYear: 2026}, "3008": {minYear: 2009, maxYear: 2026}, "Partner": {minYear: 1996, maxYear: 2026}, "206": {minYear: 1999, maxYear: 2012}, "207": {minYear: 2007, maxYear: 2014}, "508": {minYear: 2011, maxYear: 2026}, "5008": {minYear: 2010, maxYear: 2026}, "Rifter": {minYear: 2019, maxYear: 2026}, "Landtrek": {minYear: 2021, maxYear: 2026} },
    "Mazda": { "Mazda3": {minYear: 2003, maxYear: 2026}, "Mazda6": {minYear: 2002, maxYear: 2026}, "CX-5": {minYear: 2012, maxYear: 2026}, "CX-30": {minYear: 2019, maxYear: 2026}, "BT-50": {minYear: 2006, maxYear: 2026}, "Mazda2": {minYear: 2007, maxYear: 2026}, "CX-3": {minYear: 2016, maxYear: 2026}, "CX-9": {minYear: 2007, maxYear: 2026}, "CX-60": {minYear: 2023, maxYear: 2026}, "CX-90": {minYear: 2024, maxYear: 2026}, "MX-5": {minYear: 1990, maxYear: 2026} },
    "Ford": { "Ranger": {minYear: 1990, maxYear: 2026}, "F-150": {minYear: 1990, maxYear: 2026}, "Explorer": {minYear: 1990, maxYear: 2026}, "Territory": {minYear: 2020, maxYear: 2026}, "Escape": {minYear: 2001, maxYear: 2026}, "EcoSport": {minYear: 2003, maxYear: 2022}, "Edge": {minYear: 2007, maxYear: 2026}, "Expedition": {minYear: 1997, maxYear: 2026}, "Mustang": {minYear: 1990, maxYear: 2026}, "Bronco": {minYear: 2021, maxYear: 2026}, "Maverick": {minYear: 2022, maxYear: 2026}, "Transit": {minYear: 2000, maxYear: 2026} },
    "Volkswagen": { "Gol": {minYear: 1990, maxYear: 2023}, "Polo": {minYear: 2000, maxYear: 2026}, "Amarok": {minYear: 2010, maxYear: 2026}, "T-Cross": {minYear: 2019, maxYear: 2026}, "Nivus": {minYear: 2021, maxYear: 2026}, "Taos": {minYear: 2021, maxYear: 2026}, "Tiguan": {minYear: 2008, maxYear: 2026}, "Saveiro": {minYear: 1990, maxYear: 2026}, "Virtus": {minYear: 2018, maxYear: 2026}, "Vento": {minYear: 2006, maxYear: 2026}, "Jetta": {minYear: 1990, maxYear: 2026}, "Golf": {minYear: 1990, maxYear: 2026} },
    "Subaru": { "Impreza": {minYear: 1993, maxYear: 2026}, "XV": {minYear: 2012, maxYear: 2024}, "Crosstrek": {minYear: 2023, maxYear: 2026}, "Forester": {minYear: 1997, maxYear: 2026}, "Outback": {minYear: 1995, maxYear: 2026}, "Legacy": {minYear: 1990, maxYear: 2026}, "WRX": {minYear: 1992, maxYear: 2026}, "Evoltis": {minYear: 2021, maxYear: 2026} },
    "Mitsubishi": { "L200": {minYear: 1990, maxYear: 2026}, "Montero Sport": {minYear: 1997, maxYear: 2026}, "Outlander": {minYear: 2003, maxYear: 2026}, "ASX": {minYear: 2011, maxYear: 2026}, "Eclipse Cross": {minYear: 2018, maxYear: 2026}, "Xpander": {minYear: 2022, maxYear: 2026}, "Mirage": {minYear: 2013, maxYear: 2026}, "Lancer": {minYear: 1990, maxYear: 2018} },
    "MG": { "MG3": {minYear: 2012, maxYear: 2026}, "ZS": {minYear: 2018, maxYear: 2026}, "RX5": {minYear: 2018, maxYear: 2026}, "HS": {minYear: 2020, maxYear: 2026}, "MG5": {minYear: 2021, maxYear: 2026}, "MG6": {minYear: 2013, maxYear: 2026}, "ZX": {minYear: 2021, maxYear: 2026}, "Marvel R": {minYear: 2022, maxYear: 2026}, "MG4": {minYear: 2023, maxYear: 2026} },
    "Chery": { "Tiggo 2": {minYear: 2017, maxYear: 2026}, "Tiggo 2 Pro": {minYear: 2021, maxYear: 2026}, "Tiggo 3": {minYear: 2014, maxYear: 2026}, "Tiggo 4": {minYear: 2019, maxYear: 2026}, "Tiggo 7 Pro": {minYear: 2021, maxYear: 2026}, "Tiggo 8": {minYear: 2019, maxYear: 2026}, "Tiggo 8 Pro": {minYear: 2022, maxYear: 2026}, "Arrizo 5": {minYear: 2016, maxYear: 2026}, "IQ": {minYear: 2007, maxYear: 2021} }
  },
  "Moto": {
    "Yamaha": { "MT-03": {minYear: 2016, maxYear: 2026}, "MT-07": {minYear: 2014, maxYear: 2026}, "MT-09": {minYear: 2014, maxYear: 2026}, "MT-10": {minYear: 2016, maxYear: 2026}, "R15": {minYear: 2008, maxYear: 2026}, "R3": {minYear: 2015, maxYear: 2026}, "R7": {minYear: 2022, maxYear: 2026}, "R1": {minYear: 1998, maxYear: 2026}, "FZ-S": {minYear: 2014, maxYear: 2026}, "FZ-25": {minYear: 2017, maxYear: 2026}, "FZ-16": {minYear: 2009, maxYear: 2016}, "Tenere 700": {minYear: 2019, maxYear: 2026}, "Super Tenere 1200": {minYear: 2010, maxYear: 2026}, "NMAX 155": {minYear: 2016, maxYear: 2026}, "XMAX 300": {minYear: 2017, maxYear: 2026}, "TMAX": {minYear: 2001, maxYear: 2026}, "Aerox": {minYear: 2021, maxYear: 2026}, "Ray ZR": {minYear: 2021, maxYear: 2026}, "Fazer 150": {minYear: 2014, maxYear: 2026}, "Fazer 250": {minYear: 2008, maxYear: 2026}, "XT660R": {minYear: 2004, maxYear: 2016}, "WR250F": {minYear: 2001, maxYear: 2026}, "WR450F": {minYear: 2003, maxYear: 2026}, "YZ250": {minYear: 1990, maxYear: 2026}, "YZ250F": {minYear: 2001, maxYear: 2026}, "YZ450F": {minYear: 2003, maxYear: 2026}, "XTZ 125": {minYear: 2003, maxYear: 2026}, "Lander 250": {minYear: 2007, maxYear: 2026}, "XTZ 150 Crosser": {minYear: 2018, maxYear: 2026} },
    "Honda": { "CB500X": {minYear: 2013, maxYear: 2026}, "Navi": {minYear: 2016, maxYear: 2026}, "XR190L": {minYear: 2017, maxYear: 2026}, "XR150L": {minYear: 2015, maxYear: 2026}, "CB190R": {minYear: 2016, maxYear: 2026}, "CBR500R": {minYear: 2013, maxYear: 2026}, "Africa Twin": {minYear: 2016, maxYear: 2026}, "CB125F": {minYear: 2015, maxYear: 2026}, "CG150 Titan": {minYear: 2004, maxYear: 2026}, "Elite 125": {minYear: 2008, maxYear: 2026}, "PCX 150/160": {minYear: 2013, maxYear: 2026}, "ADV 150": {minYear: 2020, maxYear: 2026}, "Tornado 250": {minYear: 2001, maxYear: 2026}, "CRF250F": {minYear: 2019, maxYear: 2026}, "CRF300L": {minYear: 2021, maxYear: 2026}, "CRF250L": {minYear: 2013, maxYear: 2020}, "CBR250R": {minYear: 2011, maxYear: 2026}, "CBR650R": {minYear: 2019, maxYear: 2026}, "CB650R": {minYear: 2019, maxYear: 2026}, "NC750X": {minYear: 2014, maxYear: 2026}, "Rebel 300": {minYear: 2017, maxYear: 2026}, "Rebel 500": {minYear: 2017, maxYear: 2026}, "GL1800 Gold Wing": {minYear: 2001, maxYear: 2026}, "CRF450R": {minYear: 2002, maxYear: 2026}, "CRF250R": {minYear: 2004, maxYear: 2026}, "Dio": {minYear: 2021, maxYear: 2026}, "Sahara 300": {minYear: 2024, maxYear: 2026} },
    "Bajaj": { "Pulsar RS200": {minYear: 2015, maxYear: 2026}, "Pulsar NS200": {minYear: 2013, maxYear: 2026}, "Pulsar NS160": {minYear: 2017, maxYear: 2026}, "Pulsar NS125": {minYear: 2021, maxYear: 2026}, "Pulsar N250": {minYear: 2023, maxYear: 2026}, "Dominar 400": {minYear: 2017, maxYear: 2026}, "Dominar 250": {minYear: 2020, maxYear: 2026}, "Avenger 220": {minYear: 2010, maxYear: 2026}, "Avenger 160": {minYear: 2019, maxYear: 2026}, "Boxer 150": {minYear: 2012, maxYear: 2026}, "Platina 100": {minYear: 2006, maxYear: 2026}, "Platina 125": {minYear: 2008, maxYear: 2026}, "Discover 125": {minYear: 2011, maxYear: 2026} },
    "Kawasaki": { "Ninja 400": {minYear: 2018, maxYear: 2026}, "Z400": {minYear: 2019, maxYear: 2026}, "Versys-X 300": {minYear: 2017, maxYear: 2026}, "KLR 650": {minYear: 1987, maxYear: 2026}, "Z650": {minYear: 2017, maxYear: 2026}, "Ninja 300": {minYear: 2013, maxYear: 2026}, "Ninja 650": {minYear: 2006, maxYear: 2026}, "Ninja ZX-6R": {minYear: 1995, maxYear: 2026}, "Ninja ZX-10R": {minYear: 2004, maxYear: 2026}, "Z900": {minYear: 2017, maxYear: 2026}, "Z1000": {minYear: 2003, maxYear: 2026}, "Versys 650": {minYear: 2007, maxYear: 2026}, "Versys 1000": {minYear: 2012, maxYear: 2026}, "Vulcan S": {minYear: 2015, maxYear: 2026}, "KX250": {minYear: 1990, maxYear: 2026}, "KX450": {minYear: 2006, maxYear: 2026}, "KLX140": {minYear: 2008, maxYear: 2026}, "KLX230": {minYear: 2020, maxYear: 2026}, "KLX250": {minYear: 2009, maxYear: 2026}, "KLX300": {minYear: 2021, maxYear: 2026}, "W800": {minYear: 2011, maxYear: 2026} },
    "KTM": { "Duke 200": {minYear: 2012, maxYear: 2026}, "Duke 250": {minYear: 2017, maxYear: 2026}, "Duke 390": {minYear: 2013, maxYear: 2026}, "RC 200": {minYear: 2014, maxYear: 2026}, "RC 390": {minYear: 2014, maxYear: 2026}, "390 Adventure": {minYear: 2020, maxYear: 2026}, "250 Adventure": {minYear: 2021, maxYear: 2026}, "790 Duke": {minYear: 2018, maxYear: 2026}, "890 Duke R": {minYear: 2020, maxYear: 2026}, "890 Adventure": {minYear: 2021, maxYear: 2026}, "1290 Super Duke R": {minYear: 2014, maxYear: 2026}, "1290 Super Adventure": {minYear: 2015, maxYear: 2026}, "EXC-F 250": {minYear: 2007, maxYear: 2026}, "EXC-F 350": {minYear: 2012, maxYear: 2026}, "EXC-F 450": {minYear: 2003, maxYear: 2026}, "EXC 300": {minYear: 1990, maxYear: 2026} },
    "Suzuki": { "Gixxer 150": {minYear: 2014, maxYear: 2026}, "Gixxer 250": {minYear: 2020, maxYear: 2026}, "V-Strom 250": {minYear: 2018, maxYear: 2026}, "V-Strom 650": {minYear: 2004, maxYear: 2026}, "V-Strom 1050": {minYear: 2020, maxYear: 2026}, "GSX-R150": {minYear: 2017, maxYear: 2026}, "GSX-S150": {minYear: 2017, maxYear: 2026}, "GSX-S750": {minYear: 2015, maxYear: 2026}, "GSX-R600": {minYear: 1992, maxYear: 2026}, "GSX-R1000": {minYear: 2001, maxYear: 2026}, "DR650": {minYear: 1990, maxYear: 2026}, "Burgman 400": {minYear: 1998, maxYear: 2026}, "Hayabusa": {minYear: 1999, maxYear: 2026}, "RM-Z250": {minYear: 2004, maxYear: 2026}, "RM-Z450": {minYear: 2005, maxYear: 2026} },
    "TVS": { "Apache RTR 160 4V": {minYear: 2019, maxYear: 2026}, "Apache RTR 200 4V": {minYear: 2016, maxYear: 2026}, "Apache RR 310": {minYear: 2018, maxYear: 2026}, "NTORQ 125": {minYear: 2020, maxYear: 2026}, "Raider 125": {minYear: 2022, maxYear: 2026}, "Ronin 225": {minYear: 2023, maxYear: 2026}, "HLX 150": {minYear: 2019, maxYear: 2026} },
    "BMW": { "G310R": {minYear: 2017, maxYear: 2026}, "G310GS": {minYear: 2018, maxYear: 2026}, "F750GS": {minYear: 2018, maxYear: 2026}, "F850GS": {minYear: 2018, maxYear: 2026}, "F900R": {minYear: 2020, maxYear: 2026}, "F900XR": {minYear: 2020, maxYear: 2026}, "R1200GS": {minYear: 2004, maxYear: 2018}, "R1250GS": {minYear: 2019, maxYear: 2026}, "R1300GS": {minYear: 2024, maxYear: 2026}, "S1000RR": {minYear: 2009, maxYear: 2026}, "S1000XR": {minYear: 2015, maxYear: 2026} },
    "Royal Enfield": { "Meteor 350": {minYear: 2021, maxYear: 2026}, "Himalayan": {minYear: 2016, maxYear: 2026}, "Himalayan 450": {minYear: 2024, maxYear: 2026}, "Interceptor 650": {minYear: 2018, maxYear: 2026}, "Continental GT 650": {minYear: 2018, maxYear: 2026}, "Classic 350": {minYear: 2022, maxYear: 2026}, "Hunter 350": {minYear: 2023, maxYear: 2026}, "Super Meteor 650": {minYear: 2023, maxYear: 2026} },
    "CFMoto": { "150NK": {minYear: 2016, maxYear: 2026}, "250NK": {minYear: 2018, maxYear: 2026}, "300NK": {minYear: 2020, maxYear: 2026}, "300SR": {minYear: 2020, maxYear: 2026}, "400NK": {minYear: 2017, maxYear: 2026}, "450SR": {minYear: 2023, maxYear: 2026}, "650MT": {minYear: 2017, maxYear: 2026}, "650NK": {minYear: 2014, maxYear: 2026}, "700CL-X": {minYear: 2021, maxYear: 2026}, "800MT": {minYear: 2022, maxYear: 2026} },
    "Haojue": { "DR160": {minYear: 2019, maxYear: 2026}, "NK150": {minYear: 2020, maxYear: 2026}, "KA150": {minYear: 2018, maxYear: 2026}, "TR150": {minYear: 2017, maxYear: 2026}, "UHR150": {minYear: 2023, maxYear: 2026} },
    "Triumph": { "Trident 660": {minYear: 2021, maxYear: 2026}, "Tiger Sport 660": {minYear: 2022, maxYear: 2026}, "Street Triple": {minYear: 2007, maxYear: 2026}, "Speed Triple": {minYear: 1994, maxYear: 2026}, "Tiger 900": {minYear: 2020, maxYear: 2026}, "Tiger 1200": {minYear: 2012, maxYear: 2026}, "Bonneville T100": {minYear: 2002, maxYear: 2026}, "Bonneville T120": {minYear: 2016, maxYear: 2026}, "Scrambler 400 X": {minYear: 2024, maxYear: 2026}, "Speed 400": {minYear: 2024, maxYear: 2026} },
    "Ducati": { "Monster": {minYear: 1993, maxYear: 2026}, "Scrambler": {minYear: 2015, maxYear: 2026}, "Multistrada V2": {minYear: 2022, maxYear: 2026}, "Multistrada V4": {minYear: 2021, maxYear: 2026}, "Panigale V2": {minYear: 2020, maxYear: 2026}, "Panigale V4": {minYear: 2018, maxYear: 2026}, "Streetfighter V4": {minYear: 2020, maxYear: 2026} }
  }
};

window.formatMileage = function(input) {
  let val = input.value.replace(/\D/g, '');
  if (val.startsWith('0')) val = val.substring(1);
  if (val.length > 6) val = val.substring(0, 6);
  input.value = val.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

// Carga las marcas en orden alfabético
window.updateBrands = function() {
  const type = document.querySelector('input[name="vehicleType"]:checked').value;
  const brandSelect = document.getElementById('brand');
  const modelSelect = document.getElementById('model');
  const yearSelect = document.getElementById('year');

  brandSelect.innerHTML = '<option value="">Selecciona la marca...</option>';
  modelSelect.innerHTML = '<option value="">Primero selecciona marca</option>';
  yearSelect.innerHTML = '<option value="">Selecciona modelo...</option>';
  
  modelSelect.disabled = true;
  yearSelect.disabled = true;

  if (type) {
    brandSelect.disabled = false;
    let brands = Object.keys(vehicleDB[type]).sort();
    brands.forEach(brand => {
      let option = document.createElement('option');
      option.value = brand;
      option.text = brand;
      brandSelect.appendChild(option);
    });
  }
};

// Carga los modelos en orden alfabético
window.updateModels = function() {
  const type = document.querySelector('input[name="vehicleType"]:checked').value;
  const brand = document.getElementById('brand').value;
  const modelSelect = document.getElementById('model');
  const yearSelect = document.getElementById('year');
  
  modelSelect.innerHTML = '<option value="">Selecciona el modelo...</option>';
  yearSelect.innerHTML = '<option value="">Selecciona modelo...</option>';
  yearSelect.disabled = true;
  
  if (brand !== "") {
    modelSelect.disabled = false;
    let models = Object.keys(vehicleDB[type][brand]).sort();
    models.forEach(model => {
      let option = document.createElement('option');
      option.value = model;
      option.text = model;
      modelSelect.appendChild(option);
    });
  } else {
    modelSelect.disabled = true;
  }
};

// AÑO ESTRICTO: Genera las opciones en la ruleta desde el más nuevo al más viejo
window.updateYears = function() {
  const type = document.querySelector('input[name="vehicleType"]:checked').value;
  const brand = document.getElementById('brand').value;
  const model = document.getElementById('model').value;
  const yearSelect = document.getElementById('year');
  
  yearSelect.innerHTML = '<option value="">Selecciona el año...</option>';
  
  if (model !== "") {
    const limits = vehicleDB[type][brand][model];
    yearSelect.disabled = false;
    
    for (let y = limits.maxYear; y >= limits.minYear; y--) {
      let option = document.createElement('option');
      option.value = y;
      option.text = y;
      yearSelect.appendChild(option);
    }
  } else {
    yearSelect.disabled = true;
  }
};

// --- LOGICA DE SESIÓN (Mantenida) ---
async function checkSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('app-section').classList.remove('hidden');
    cargarVehiculos();
  } else {
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('app-section').classList.add('hidden');
  }
}
checkSession();

window.signUp = async function() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { error } = await supabaseClient.auth.signUp({ email, password });
  if (error) alert(error.message);
  else alert("Cuenta creada. Revisa tu correo o inicia sesión.");
}

window.signIn = async function() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) alert(error.message);
  else checkSession();
}

window.signOut = async function() {
  await supabaseClient.auth.signOut();
  currentUser = null;
  checkSession();
}

// --- LOGICA DE CONSULTA IA ---
window.analizarVehiculo = async function() {
  const typeRadio = document.querySelector('input[name="vehicleType"]:checked');
  if(!typeRadio) { alert("Selecciona si es Auto o Moto."); return; }
  
  const type = typeRadio.value;
  const brand = document.getElementById('brand').value;
  const model = document.getElementById('model').value;
  const year = document.getElementById('year').value;
  const rawMileageInput = document.getElementById('mileage').value;
  const mileage = rawMileageInput.replace(/\./g, '');
  
  if(!brand || !model || !year || !mileage) {
    alert("Por favor, completa todos los datos obligatorios.");
    return;
  }

  const responseContainer = document.getElementById('ai-response-container');
  const responseBox = document.getElementById('ai-response');
  
  responseBox.innerHTML = '<p class="text-zinc-400 text-center animate-pulse">⚙️ Analizando diagnóstico técnico...</p>';
  responseContainer.classList.remove('hidden');

  const payload = {
    type: type,
    brand: brand,
    model: model,
    year: year,
    mileage: mileage,
    customQuery: document.getElementById('customQuery').value
  };

  try {
    const res = await fetch('/api/analizar-vehiculo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    
    if (data.error) {
      responseBox.innerHTML = `<p class="text-red-400 font-mono text-xs">Error de Sistema: ${data.error}</p>`;
    } else {
      let htmlResponse = data.result
        .replace(/\n/g, '<br>')
        .replace(/-/g, '<span class="text-zinc-500 mr-2">▶</span>')
        .replace(/\[ESTADO\]/g, '<div class="mb-5 bg-zinc-900 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-md"><h5 class="text-amber-500 font-bold uppercase tracking-widest text-xs mb-2">Estado General</h5><p class="text-zinc-300 text-sm leading-relaxed">')
        .replace(/\[CRITICO\]/g, '</p></div><div class="mb-5 bg-zinc-900 border-l-4 border-red-500 p-4 rounded-r-lg shadow-md"><h5 class="text-red-400 font-bold uppercase tracking-widest text-xs mb-2">Puntos Críticos</h5><p class="text-zinc-300 text-sm leading-relaxed">')
        .replace(/\[MANTENIMIENTO\]/g, '</p></div><div class="bg-zinc-900 border-l-4 border-emerald-500 p-4 rounded-r-lg shadow-md"><h5 class="text-emerald-400 font-bold uppercase tracking-widest text-xs mb-2">Mantenimiento Preventivo</h5><p class="text-zinc-300 text-sm leading-relaxed">')
        + "</p></div>";

      responseBox.innerHTML = htmlResponse;
    }
  } catch (err) {
    responseBox.innerHTML = '<p class="text-red-400 font-mono text-xs">Error de conexión al servidor.</p>';
  }
}

window.guardarVehiculo = async function() {
  const brand = document.getElementById('brand').value;
  const model = document.getElementById('model').value;
  const year = document.getElementById('year').value;
  const rawMileageInput = document.getElementById('mileage').value;
  const mileage = rawMileageInput.replace(/\./g, '');

  if(!brand || !model || !year || !mileage) {
    alert("Completa todos los datos antes de guardar.");
    return;
  }

  const { error } = await supabaseClient.from('vehicles').insert([
    { user_id: currentUser.id, brand, model, year, mileage }
  ]);

  if (error) alert("Error al guardar: " + error.message);
  else {
    alert("Vehículo guardado exitosamente en el Garage.");
    cargarVehiculos();
  }
}

async function cargarVehiculos() {
  const { data, error } = await supabaseClient.from('vehicles').select('*').eq('user_id', currentUser.id);
  const lista = document.getElementById('vehicle-list');
  lista.innerHTML = '';
  if (data) {
    data.forEach(v => {
      const formatoKm = v.mileage.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      const li = document.createElement('li');
      li.className = "p-4 bg-zinc-900/80 border border-zinc-800 rounded flex justify-between items-center shadow-lg transition-transform hover:scale-[1.01]";
      li.innerHTML = `
        <span>
          <span class="text-amber-500 font-bold uppercase tracking-wider text-xs">${v.brand}</span> 
          <span class="text-zinc-300 font-medium ml-2">${v.model} (${v.year})</span>
        </span> 
        <span class="bg-zinc-800/80 border border-zinc-700 px-3 py-1 text-amber-500 rounded text-xs font-mono font-bold tracking-widest shadow-inner">${formatoKm} KM</span>
      `;
      lista.appendChild(li);
    });
  }
}