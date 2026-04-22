fetch("http://localhost:3000/api/admin/emails?vbpoNo=VB259-17")
  .then(res => res.json())
  .then(data => {
    if (data.emails) {
      data.emails.forEach(e => console.log(`Type: ${e.type}, FolderPath: "${e.folderPath}", Subject: "${e.subject}"`));
    } else {
      console.log("No emails found");
    }
  })
  .catch(console.error);
