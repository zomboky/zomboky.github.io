    const titre = document.getElementById('bienvenue');
    let dots = 0;

    setInterval(() => {
      dots = (dots + 1) % 4; // 0 à 3 points
      titre.textContent = 'Bienvenue sur mon site' + '.'.repeat(dots);
    }, 50); 				// timing du changement


    