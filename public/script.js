document.getElementById('searchForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const actorName = document.getElementById('actorName').value.trim();
    if (actorName) {
        searchActor(actorName);
    }
});

async function searchActor(name) {
    try {
        const response = await fetch(`/actors/${name}`);
        if (response.ok) {
            const actorData = await response.json();
            displayResult([actorData]);
            loadCache();  
        } else if (response.status === 404) {
            alert('Actor no encontrado.');
            clearTable();
        } else {
            throw new Error('Error en la búsqueda');
        }
    } catch (error) {
        console.error(error);
        alert('Hubo un error al buscar el actor.');
    }
}

function displayResult(data) {
    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';  

    data.forEach(actor => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${actor.primaryName}</td>
            <td>${actor.birthYear || 'N/A'}</td>
            <td>${actor.deathYear || 'N/A'}</td>
            <td>${actor.primaryProfession || 'N/A'}</td>
            <td>${actor.knownForTitle || 'N/A'}</td>
            <td>
                <button class="btn btn-danger btn-sm" onclick="deleteActor('${actor.primaryName}')">Eliminar</button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

async function deleteActor(name) {
    if (!confirm(`¿Seguro que quieres eliminar al actor "${name}"?`)) {
        return;
    }

    try {
        const response = await fetch(`/actors/${name}`, { method: 'DELETE' });
        if (response.ok) {
            alert(`Actor "${name}" eliminado con éxito.`);
            clearTable();
            loadCache();  
        } else {
            throw new Error('Error al eliminar el actor');
        }
    } catch (error) {
        console.error(error);
        alert('Hubo un error al eliminar el actor.');
    }
}

// Función para limpiar la tabla de búsqueda
function clearTable() {
    document.getElementById('tableBody').innerHTML = '';
}

// Función para cargar la caché desde el servidor
async function loadCache() {
    try {
        const response = await fetch('/cache');
        const cacheData = await response.json();

        const cacheBody = document.getElementById('cacheBody');
        cacheBody.innerHTML = '';

        cacheData.forEach(entry => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${entry.key}</td>
                <td>${JSON.stringify(entry.data)}</td>
                <td>${entry.count}</td>
            `;
            cacheBody.appendChild(row);
        });
    } catch (error) {
        console.error(error);
        alert('Hubo un error al cargar la caché.');
    }
}
loadCache();
