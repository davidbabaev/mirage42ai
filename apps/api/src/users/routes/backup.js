router.post('/users', uploadImageOnly.fields([
        {name: 'profilePicture', maxCount: 1},
        {name: 'coverImage', maxCount: 1}
    ]) ,async (req, res) => {
        try{
            const {error} = validateUser(req.body)
            if(error) return res.status(400).send(error.details[0].message);
            
            let profilePictureUrl;
            let coverImageUrl;
            
            if(req.files['profilePicture']){
                //file exists
                profilePictureUrl = await uploadToCloudinary(req.files['profilePicture']?.[0].buffer, "users")
            }
            
            if(req.files['coverImage']){
                coverImageUrl = await uploadToCloudinary(req.files['coverImage']?.[0].buffer, "users")
            }
            
            let newUser = await createNewUser({
                ...req.body,
                profilePicture: profilePictureUrl,
                coverImage: coverImageUrl,
            });

            res.send(newUser);
        }
        catch(err){
            handleError(res, err);
            console.log(err.message);
        }
})