# When we support more models, we can expand this. 
def switch_model(x):
    return {
        'ECMWF-RAPID': 'ecmwf',
        'LIS-RAPID': 'lis'
    }.get(x, 'invalid') 


