fetch("http://localhost:3000/api/admin/roles/69d4008b73e45ce9f6348036", {
  method: "PUT",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({
    _id: "69d4008b73e45ce9f6348036",
    name: "NIGALU",
    permissions: []
  })
}).then(async r => {
  console.log(r.status);
  console.log(await r.text());
})
