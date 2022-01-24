## 1.0.18
* Added switch to disable wrting of the temperatures array.
* Writing different amount of temperature sensors
* Updated ast with new property
* Updaed FOSS

## 1.0.14
* Enabled Hardware V3
*

### 1.0.9
* Catch warn message in read object
* Added SENTRY to get more details for debbugging
* Only work with JSON compatible answers from your adapter
* Updated writable objects attribut #47 Thanks to GoClyde
* Enabled Sentry for debugging
* Added documentation for API v1 of go-e.co (Unsupported v2, yet)
* Added joi validation to validate response from the hardware adapter
* Update color in settings used a watch on a wrong io-object
* Error handling on status update got improved
* udpate dependencies
* Update validation error
### 1.0.1
* Error in adjustAmpLevelInWatts function
* Wrong date
* reomved endpoint changeAmpLevelInWatts
* bug float to amp/amx (Thanks mr. Dvorak)

### 1.0.0
* Publish the adapter package to ioBroker stable
* Added documentation in ./docs/Readme.md
* added unlock_state for cable management
* added amx for non permanat ampere settings
* fix Issue 17: Some adapters are not sharing the temperatures array (Many thanks to maxe1111)
* added telegram community channel
* fix issue 16: Bug in calculation of loaded_energy_kwh (Many thanks to maxe1111)
* Added all steps from Version 0.0.x
* some additional minor fixes from testing.
* (MK-2001) solved bug in maxWatts feature
* Added debug information on maxWatts Feature
* removed info-level-logging on status query
* Added function adjustAmpLevelInWatts
* Added documentation
* removed synctime bug
* adds loaded_energy_kwh (extra value for dwo for unusual unit)
* adds setAmpLevelToButton for 5 levels
* added led brightness
* (MK-2001) Activated the max Watts Feature
* Added some documentation and NPM Documentations
* Activated gulb for translation to different languages
* (MK-2001) Implemented feature to not update 111 States in paralell
* (MK-2001) Added the feature of Max Watts
* (MK-2001, Trunks1982) solved bug with different names.
* (MK-2001) added requirements to publish the adapter again, enabled new writeable interfaces: Access State (ast), Allow Charging (alw), stop_state: ​Automatische Abschaltung (stp), max_load
* (MK-2001) added requirements to publish the adapter
* (MK-2001) initial release

# Translation
Use https://translator.iobroker.in to translate texts.