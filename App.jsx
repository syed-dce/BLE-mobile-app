/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, {useEffect, useState} from 'react';

import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
  PermissionsAndroid,
  NativeEventEmitter,
  NativeModules,
  TouchableOpacity,
  View,
  FlatList,
  Image,
} from 'react-native';
import BleManager from 'react-native-ble-manager';
import {Buffer} from 'buffer';

let photo_payload;

function App() { 
  const [isScanning, setIsScanning] = useState(false);
  const [bluetoothDevices, setBluetoothDevices] = useState([]);
  const BleManagerModule = NativeModules.BleManager;
  const BleManagerEmitter = new NativeEventEmitter(BleManagerModule);
  const [currentDevice, setCurrentDevice] = useState(null);
  const [singlePic, setSinglePic] = useState(null);
  const [ photosCount, setPhotosCount ] = useState(0)

  const runATStart = async () => {
    await BleManager.start({showAlert: false});
    console.log('BleManager initialized ===============');

    await BleManager.enableBluetooth();
    console.log('Bluetooth is turned on!');

    await requestPermission();
  };

  const startScanning = () => {
    if (!isScanning) {
      BleManager.scan([], 10, true)
        .then(() => {
          console.log('Scan is started =========');

          setIsScanning(true);
        })
        .catch(error => {
          console.error(error);
        });
    }
  };

  useEffect(() => {
    let stopListener = BleManagerEmitter.addListener(
      'BleManagerStopScan',
      () => {
        setIsScanning(false);
        console.log('Scan is stopped ========= ');
        handleGetConnectedDevices();
      },
    );

    let disconnected = BleManagerEmitter.addListener(
      'BleManagerDisconnectPeripheral',
      peripheral => {
        setCurrentDevice(null)
        console.log('Disconnected Device', peripheral);
      },
    );

    let characteristicValueUpdate = BleManagerEmitter.addListener(
      'BleManagerDidUpdateValueForCharacteristic',
      data => {
        // Handle received data
        // bleServices.onCharacteristicChanged(data);

        readCharacteristicFromEvent(data);
      },
    );
    let BleManagerDidUpdateState = BleManagerEmitter.addListener(
      'BleManagerDidUpdateState',
      data => {
        // Handle received data
        console.log('BleManagerDidUpdateState Event!', data);
      },
    );

    runATStart();

    return () => {
      stopListener.remove();
      disconnected.remove();
      characteristicValueUpdate.remove();
      BleManagerDidUpdateState.remove();
    };
  }, []);

  const bytesToString = bytes => {
    return String.fromCharCode(...bytes);
  };

  const readCharacteristicFromEvent = data => {
    const {characteristic, value} = data;

    console.log('=========================');
    // const rec_data = value
    const rec_data = bytesToString(value);
    // console.log(rec_data)
    // return

    
    let full_chunk_in_hex = rec_data
      .split('')
      .reduce(
        (hex, c) => (hex += c.charCodeAt(0).toString(16).padStart(2, '0')),
        '',
      );

    console.log(full_chunk_in_hex.length)

    let first_16_bits = full_chunk_in_hex.substring(0, 4);
    let chunk_payload_in_hex = full_chunk_in_hex.substring(4);

    console.log(first_16_bits)


    if (first_16_bits === '0000') {
      // this is the first chunk
      photo_payload = chunk_payload_in_hex;
    } else if (first_16_bits !== 'ffff') {
      photo_payload = photo_payload + chunk_payload_in_hex;
    } else {
      let photo_payload_binary = photo_payload
        .match(/.{1,2}/g)
        .reduce(
          (acc, char) => acc + String.fromCharCode(parseInt(char, 16)),
          '',
        );

      /*
    let base64ImageString = Buffer.from(photo_payload, 'binary').toString('base64')
    let srcValue = "data:image/jpeg;base64,"+base64ImageString
    */

      // const imageBuffer = Buffer.from(photo_payload, 'hex'); 
      const imageBuffer = Buffer.from(photo_payload_binary, 'binary'); 
      // const imageBuffer = Buffer.from(JSON.stringify(photo_payload)); 
      const srcValue = imageBuffer.toString('base64');

      setSinglePic('data:image/jpeg;base64,' + srcValue);
      console.log('data:image/jpeg;base64,' + srcValue);
      setPhotosCount( photosCount => photosCount + 1 )
    }

    // console.log('Data:', rec_data);
  };

  const handleGetConnectedDevices = () => {
    BleManager.getDiscoveredPeripherals().then(results => {
      if (results.length == 0) {
        console.log('No connected bluetooth devices');
        startScanning();
      } else {
        const allDevices = results.filter(item => item.name === "ESP32DEVICE" || item.name === "Esp32Device" );
        console.log(allDevices);
        setBluetoothDevices(allDevices);
      }
    });
  };

  const requestPermission = async () => {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    );
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    );
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
    );
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    );
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    startScanning();
  };

  const onChangeCharacteristics = (serviceUUID, result, item) => {
    if (serviceUUID != '19b10000-e8f2-537e-4f6c-d104768a1214') {
      return;
    }

    console.log('SERVICE UUIDS:::', serviceUUID);
    result.forEach(characteristic => {
      const characteristicUUID = characteristic.characteristic;
      console.log(characteristicUUID);
      if (characteristicUUID === '19b10005-e8f2-537e-4f6c-d104768a1214') {
        BleManager.startNotification(item.id, serviceUUID, characteristicUUID)
          .then(() => {
            console.log(
              'Notification started for characteristic:',
              characteristicUUID,
            );
          })
          .catch(error => {
            console.error('Notification error:', error);
          });
      }
    });

    // console.log("RESULT", result)
    // result.forEach((characteristic) => {
    //     const characteristicUUID = characteristic.characteristic
    //     if (characteristicUUID === "00002a01-0000-1000-8000-00805f9b34fb") {
    //         readCharacteristic(characteristicUUID, serviceUUID, item)
    //     }
    //     if (characteristicUUID === TEMPERATURE_UUID || characteristicUUID === HUMIDITY_UUID) {
    //         BleManager.startNotification(item.id, serviceUUID, characteristicUUID)
    //             .then(() => {
    //                 console.log('Notification started for characteristic:', characteristicUUID);
    //             })
    //             .catch(error => {
    //                 console.error('Notification error:', error);
    //             });
    //     }

    // })
  };

  const onServicesDiscovered = (result, item) => {
    const services = result?.services;
    const characteristics = result?.characteristics;

    services.forEach(service => {
      const serviceUUID = service.uuid;

      onChangeCharacteristics(serviceUUID, characteristics, item);
    });
  };

  const onConnect = async (item, index) => {
    console.log('CONNECTED DEVICE:::', item);
    try {
      await BleManager.connect(item.id);
      console.log('Connected');
      setCurrentDevice(item);

      const res = await BleManager.retrieveServices(item.id);
      console.log('RES::::', JSON.stringify(res));
      onServicesDiscovered(res, item);
      // startDistanceCheck(item);
    } catch (error) {
      // Failure code
      console.error(error);
    }
  };

  const onDisconnect = () => {
    BleManager.disconnect(currentDevice?.id).then(() => {
      setCurrentDevice(null);
      // clearInterval(distanceInterval);
      // setStatus('Lock');
    });
  };

  const renderItem = ({item, index}) => {
    // console.log('BLE ITEM:::', JSON.stringify(item));
    return (
      <View>
        <View style={styles.bleCard}>
          <Text style={styles.nameTxt}>{item.name}</Text>
          <TouchableOpacity
            onPress={() =>
              item.id === currentDevice?.id
                ? onDisconnect()
                : onConnect(item, index)
            }
            style={styles.button}>
            <Text style={styles.btnTxt}>
              {item.id === currentDevice?.id ? 'Disconnect' : 'Connect'}
            </Text>
          </TouchableOpacity>
          {/* <TouchableOpacity
            onPress={() => onConnect(item, index)}
            style={styles.button}>
            <Text style={styles.btnTxt}>Connect</Text>
          </TouchableOpacity> */}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.componentContainer}>
      <View>
        <Text style={styles.heading}>Bluetooth LE App</Text>
      </View>
      {isScanning ? (
        <Text>Scanning ....</Text>
      ) : (
        <View style={{ height: '15%' }}>
          <FlatList
            data={bluetoothDevices}
            keyExtractor={(item, index) => index.toString()}
            renderItem={renderItem}
          />
        </View>
      )}
      <Text>-</Text>
      {singlePic ? (
        <Image
          style={styles.image}
          source={{
            uri: singlePic,
          }}
        />
      ) : (
        <></>
      )}
      <Text style={{ fontSize: 22 }}>Photos count: {photosCount}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  componentContainer: {
    padding: 22,
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    // justifyContent: 'center'
  },
  image: {
    width: '95%',
    height: '50%',
    resizeMode: 'contain',  
  },
  bleCard: {
    width: '95%',
    padding: 10,
    alignSelf: 'center',
    marginVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'lightgrey',
    elevation: 5,
    borderRadius: 5,
  },
  nameTxt: {
    // fontFamily: fonts.bold,
    // fontSize: fontSize.font18,
    // color: colors.text
  },
  button: {
    width: 100,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 5,
  },
  btnTxt: {
    // fontFamily: fonts.bold,
    // fontSize: fontSize.font18,
    // color: colors.white
  },
  label: {
    fontSize: 20,
    textAlign: 'center',
    // color: colors.text,
    // fontFamily: fonts.bold,
  },
  icon: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
    marginVertical: 2,
  },
  tempCard: {
    width: 45,
    // backgroundColor: colors.secondary,
    elevation: 2,
    paddingVertical: 2,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 2,
    alignSelf: 'center',
  },
  scanBtn: {
    width: '90%',
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor: colors.primary,
    borderRadius: 5,
    alignSelf: 'center',
    marginBottom: 2,
  },
  heading: {
    fontWeight: 'bold',
    fontSize: 28,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
});

export default App;
