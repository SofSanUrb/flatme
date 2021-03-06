const router = require("express").Router();
const bcrypt = require('bcryptjs');
const UserModel = require('../models/User.js')
const CommentModel = require('../models/Comment.js');
const geocoder = require('../utils/geocoder');
const capitalized = (string) => string[0].toUpperCase() + string.slice(1).toLowerCase();
const uploader = require('../utils/cloudinary.config.js');
const countriesList = require('../utils/countries.js')

const checkLoggedInUser = (req, res, next) =>{
  if(req.session.loggedInUser){
    next()
  }
  else {
    res.redirect('/login')
  }
}

//GET Methods
router.get('/reviews', checkLoggedInUser, (req, res, next)=>{
  
  CommentModel.find().populate('userId')
    .then((result) => {
      result.forEach((elem)=>{
        let month = elem.dateRegister.toDateString().split(' ')[1]
        let year = elem.dateRegister.toDateString().split(' ')[3]
        elem.dateString = `${month} ${year}`
      })
      res.render('user/reviews', {review: result})
    })
    .catch((error)=>{
      next(error)
    })
})

router.get('/writereview',checkLoggedInUser, (req, res, next) =>{
  res.render('user/writereview')
})

router.get('/profile',checkLoggedInUser, (req, res, next) =>{

  let email = req.session.loggedInUser.email

  UserModel.find({email : email})
    .then((user)=>{
      CommentModel.find({userId: req.session.loggedInUser._id})
            .populate('userId')
            .then((comment) => {
              comment.forEach((elem)=>{
                let month = elem.dateRegister.toDateString().split(' ')[1]
                let year = elem.dateRegister.toDateString().split(' ')[3]
                elem.dateString = `${month} ${year}`
              })
              let isDrafts = false;
              comment.forEach(elem => {
                if (!elem.published) {
                  isDrafts = true;
                }
              })
              res.render('user/profile', {user, comment, isDrafts})
            })
    })
    .catch(()=>{
      console.log('Something is not working rendering the user')
    })

})

router.get('/profile/edit', checkLoggedInUser, (req, res, next)=>{

  let email = req.session.loggedInUser.email

  UserModel.find({email : email})
    .then((user)=>{
      res.render('user/update-profile', {user, countriesList: countriesList})
    })
    .catch((err)=>{
      next(err)
    })
})

router.get('/profile/edit-picture', checkLoggedInUser, (req, res, next)=>{

  let email = req.session.loggedInUser.email

  UserModel.find({email : email})
    .then((user)=>{
      res.render('user/update-picture', {user})
    })
    .catch((err)=>{
      next(err)
    })

})

router.get('/review/:id/edit/',checkLoggedInUser, (req,res,next)=>{

  let id = req.params.id

  CommentModel.findById(id)
    .then((comment)=>{
      res.render('user/update-review', {comment})
    })
    .catch((err)=>{
       next(err)
    })
})

router.get('/reviews/:id/delete/', checkLoggedInUser, (req, res, next)=>{

  let id = req.params.id

  CommentModel.findByIdAndDelete(id)
    .then(()=>{
      res.redirect('/profile')
    })
    .catch(()=>{
      console.log('Not possible to delete')
    })
})

router.get('/change-password', (req,res,next)=>{

})

router.get('/logout', checkLoggedInUser, (req,res,next)=>{
  req.session.destroy()
  res.redirect('/')
})

router.get('/flatmecoordinates', (req, res, next) =>{
  CommentModel.find()
    .then((result) => res.json(result))
})

//POST Methods
router.post('/profile/edit', (req, res, next) => {
  const {name, lastname, country} = req.body;

  let user = [{
    name: name,
    lastname : lastname,
    country: country
  }]

  if(!user[0].name || !user[0].lastname || !user[0].country){
    res.render('user/update-profile', {msg: 'Please enter all fields', user, countriesList: countriesList})
  } else {
    UserModel.findOneAndUpdate({email : req.session.loggedInUser.email}, user[0])
    .then(() => res.redirect('/profile'))
    .catch((err) => next(err))
  }
})

router.post('/profile/edit-picture', uploader.single("picture"), (req, res, next)=>{

  let picturePath = "";
  (req.file) ? picturePath = req.file.path : picturePath = "/images/baseProfile.png"

  let editedUser = {
    picture: picturePath
  }

  UserModel.findOneAndUpdate({email : req.session.loggedInUser.email}, editedUser)
    .then(() => res.redirect('/profile'))
    .catch((err) => next(err))
})

router.post('/profile/cancelEdit', (req, res, next) => {
  res.redirect('/profile')
})

router.post('/review/:id/edit', (req,res, next)=>{

  let id = req.params.id

  const {city, zipcode, title, review, score, tags} = req.body;

  let editedComment = {
    city: city,
    zipcode: zipcode,
    title: title,
    review: review,
    score: score,
    tags: tags,
  }

  CommentModel.findByIdAndUpdate(id, editedComment)
    .then(()=>{
      res.redirect('/profile')
    })
    .catch((err)=>{
      next(err)
    })
  
});

router.post('/writereview', (req, res, next) => {
  const {city, zipcode, title, review, score, tags} = req.body;
  
  let reviewBody = {
    city: city,
    zipcode: zipcode,
    title: title,
    review: review,
    score: score,
    tags: tags
  }
  //check for all required filled in values
  if (zipcode.length != 5 && zipcode.length) {
    res.render('user/writereview', {msg: 'Zipcode must have 5 numbers', reviewBody})
     return;
  }
  else if (!city.length || !zipcode.length || !title.length || !review.length || !score.length ) {
     res.render('user/writereview', {msg: 'Please enter all fields', reviewBody})
     return;
  }

  
  // create a review on the database
  CommentModel.create({city, zipcode, title, review, score, tags, userId: req.session.loggedInUser._id})
    .then(() => {
      res.redirect('/profile')
    })
    .catch((err) => next(err))
    
})

router.post('/publishreview', (req, res, next) => {
  const {city,zipcode, title, review, score, tags} = req.body;

  let reviewBody = {
    city: city,
    zipcode: zipcode,
    title: title,
    review: review,
    score: score,
    tags: tags
  }  
  //check for all required filled in values
  if (zipcode.length != 5 && zipcode.length) {
    res.render('user/writereview', {msg: 'Zipcode must have 5 numbers', reviewBody})
     return;
  }
  else if (!city.length || !zipcode.length || !title.length || !review.length || !score.length ) {
     res.render('user/writereview', {msg: 'Please enter all fields', reviewBody})
     return;
  }

  //transform address and city into coordinates and create element in the database
  geocoder.geocode(`${zipcode}, ${city}`)
   .then((data) => {
     //update coordinates
     let idGeo = {
       type: 'Point',
       coordinates: [data[0].longitude, data[0].latitude],
       formattedAddress: data[0].formattedAddress
     }

     // create a review on the database
     CommentModel.create({idGeo, city, zipcode, title, published: true, review, score, tags, userId: req.session.loggedInUser._id})
       .then(() => res.redirect('/profile'))
       .catch((err) => next(err))
   })
})

router.post('/review/:id/edit/publish', (req, res, next)=>{

  let id = req.params.id

  const {city, zipcode, title, review, score, tags} = req.body;

  geocoder.geocode(`${zipcode}, ${city}`)
    .then((data) => {
      //update coordinates
      let idGeo = {
        type: 'Point',
        coordinates: [data[0].longitude, data[0].latitude],
        formattedAddress: data[0].formattedAddress
      }

      let editedComment = {
        city: city,
        zipcode: zipcode,
        title: title,
        review: review,
        score: score,
        tags: tags,
        published: true,
        idGeo: idGeo
      }

      CommentModel.findByIdAndUpdate(id, editedComment)
        .then(()=>{
          res.redirect('/profile')
        })
        .catch((err)=>{
          next(err)
        })
      })
})

router.post('/reviews', (req, res, next) => {
  const {score, tags, city, zipcode} = req.body;

  //Define filter according to search results
  let filter = {}

  if(score && tags && city && zipcode) {
  filter = {$and:[{score: score}, {tags: tags}, {city : city}, {zipcode : zipcode}]}
  }
  else if (score && tags && zipcode) {
    filter = {$and: [{score:score}, {tags: tags}, {zipcode : zipcode}]}
  }
  else if (tags && city && zipcode) {
    filter = {$and: [{tags:tags}, {city: city}, {zipcode : zipcode}]}
  }
  else if (city && score && zipcode) {
    filter = {$and : [{city: city}, {score: score}, {zipcode : zipcode}]}
  }
  else if (tags && score && zipcode) {
    filter = {$and : [{tags: tags}, {score: score}, {zipcode : zipcode}]}
  }
  else if (city && zipcode){
    filter = {$and : [{city: city}, {zipcode : zipcode}]}
  }
  else if (city && tags){
    filter = {$and : [{city: city}, {tags : tags}]}
  }
  else if (tags && zipcode) {
    filter = {$and : [{tags: tags}, {zipcode : zipcode}]}
  }
  else if (score && zipcode) {
    filter = {$and : [{score: score}, {zipcode : zipcode}]}
  }
  else if (score && tags) {
    filter = {$and : [{score: score}, {tags : tags}]}
  }
  else if (score && city) {
    filter = {$and : [{score: score}, {city : city}]}
  }
  else if (score){
    filter = {score : score}
  }
  else if (tags){
    filter = {tags : tags}
  }
  else if (city){
    filter = {city : city}
  }
  else if (zipcode){
    filter = {zipcode : zipcode}
  }


  CommentModel.find(filter).populate('userId')
    .then((result) => {
      result.forEach((elem)=>{
        let month = elem.dateRegister.toDateString().split(' ')[1]
        let year = elem.dateRegister.toDateString().split(' ')[3]
        elem.dateString = `${month} ${year}`
      })
      res.render('user/reviews', {review: result})
    })
    .catch(() => res.redirect('/reviews'))
})

//Export Router
module.exports = router
