# Contribute to DEER

## ❤️ Thank You
Thank you for considering a contribution!  The `main` branch is protected and you cannot push to it.  Please make a new branch, and when you are a finished open a pull request targeting the `main` branch.  The pull request will be reviewed and we will get back to you.

## Ready to Install It And Run It!

***RUN THE APP IN A WEB SERVER CONTAINER***

If you want to contribute, it is important you are able to deploy the code and run locally.  To do so, it is best you use some kind of web server such as a [Docker Container](https://docs.docker.com/get-started/) or [Tomcat Web Server](https://tomcat.apache.org/).  You can use any web server container you prefer.  

You want a web server because a core functionality of the DEER framework is to ask the internet for resources by their URI, like https://store.rerum.io/v1/id/11111.  Running DEER through your filesystem as opposed to a web server will cause errors when trying to pull in resources from the web.  Feel free to try.

Make sure Git is installed on your machine.  For download and installation instruction, [head to the Git guide](https://git-scm.com/downloads).  Note this can also be achieved by installing [GitHub for Desktop](https://desktop.github.com/).  

The following is a git shell example for installing the app on your local machine.

```
cd /web_container/
git clone https://github.com/CenterForDigitalHumanities/deer.git deer
```
### Tomcat installation Guide (Windows)

Note: The Standard Java Development Kit (JDK) needs to be installed for this to work.

A webserver is required for developing this project. This guide is for specifically Tomcat9, but alternatives exist and can be found elsewhere.

Download Tomcat9 installation wizard from the above link and set up following the installer instructions. Many people find it useful to download into the root of a drive or other easily-pathed location.

In the newly installed Tomcat9 files there should be a sub-folder called webapps. It's location could be as follows (or similar):

```
E:\Tomcat9\webapps\
```
Inside the webapps folder is where the files for our project will be stored. They can be cloned into this folder using the above "Git clone" command or moved here from elsewhere.

In powershell or command prompt navigate to the "bin" folder of the tomcat files and run the startup.bat file. This can be done using the following example of pathing commands.

```
E:\>cd Tomcat9

E:\Tomcat9>cd bin

E:\Tomcat9\bin>startup.bat
```
The user then can navigate to the "webapps" folder of the tomcat files. Here a new folder for the DEER project can be created. Navigating to this file in gitbash or windows command prompt is the proper location to clone the git files using the above git shell example.

Note: The name of the folder that the code is cloned into is case sensitive and will become the address of the webserver's localhost address (naming this folder deer will mean that the address will be localhost:####/deer. Naming this folder ROOT or replacing the existing ROOT folder will allow you to navigate to the page without a folder name at the end of the address)

The default port for tomcat9 is 8080, meaning that unless the user has specified a different port for use on this project the page for this project will be http://localhost:8080/deer/ if the folder holding the project's information is named deer.

When working on the project Tomcat9 MUST be opened and started EACH TIME prior to accessing the page. This can be done through the "monitor Tomcat" application now available on your pc.

For testing of components and functionality a test html page should be added to the deer folder root. This  be called test.html and can be viewed when testing by visiting its page at http://localhost:8080/deer/test.html.

An example of a testing html page is below:
```
<html>
    <head>
        <title>Data Encoding and Exhibition for RERUM</title>
        <meta charset="UTF-8">
        <link rel="stylesheet" href="https://unpkg.com/chota@latest">
        <script src="/js/deer.js" type="module"></script>
    </head>

    <body>
        ...
    </body>
</html>
```

That's all you need!  Now start up your web server.  If you used the example above access the viewer at http://localhost/deer.  

## 🎉 Ready to Start Contributing!

Awesome!  Make a new branch through the GitHub Interface or through your shell.  Make sure you 'checkout' that branch.

```
cd /web_container/deer
git checkout my_new_branch
```

Now you can make code changes and see them in real time.  You can make HTML pages in `/web_container/deer` and fill those pages with DEER forms and views.  Test your changes and see what they look like!  When you are finished with the commits to your new branch, open a Pull Request that targets the `main` branch at [https://github.com/CenterForDigitalHumanities/deer/tree/main/](https://github.com/CenterForDigitalHumanities/deer/tree/main/).